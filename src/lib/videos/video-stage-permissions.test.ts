import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { VideoStageActor, VideoStageAssignment } from './video-stage-permissions';
import {
  VIDEO_ARCHIVE_DENIED,
  VIDEO_PUBLICATION_DENIED,
  VIDEO_STAGE_DENIED,
  videoKanbanColumnDropDenial,
  videoStatusTransitionDenial,
} from './video-stage-permissions';

const YOULI = '35f08ba6-2a93-453d-9549-1d04d763c793';
const OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const none: VideoStageAssignment = { editorIds: [], cameramanIds: [] };

function actor(partial: Partial<VideoStageActor> & Pick<VideoStageActor, 'role'>): VideoStageActor {
  return {
    employeeId: partial.employeeId ?? OTHER,
    isDepartmentSupervisor: partial.isDepartmentSupervisor ?? false,
    department: partial.department ?? null,
    role: partial.role,
  };
}

describe('video stage permissions', () => {
  const youli = actor({
    role: 'cameraman',
    employeeId: YOULI,
    isDepartmentSupervisor: true,
    department: 'production_video',
  });
  const youliVideo: VideoStageAssignment = { editorIds: [YOULI], cameramanIds: [YOULI] };

  it('lets Youli move an editing video to the next operational stage', () => {
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'editing'), null);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'internal_review'), null);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'sent_to_client'), null);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'client_revision'), null);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'shooting_in_progress'), null);
    assert.equal(videoKanbanColumnDropDenial(youli, youliVideo, 'editing', 'client_review'), null);
  });

  it('lets Youli drag through every board column, including Livré', () => {
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'published'), null);
    assert.equal(videoKanbanColumnDropDenial(youli, youliVideo, 'editing', 'delivered'), null);
    assert.equal(videoKanbanColumnDropDenial(youli, youliVideo, 'shooting_planned', 'editing'), null);
  });

  it('keeps client approval and archive away from Youli', () => {
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'validated'), VIDEO_PUBLICATION_DENIED);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'archived'), VIDEO_ARCHIVE_DENIED);
    assert.equal(videoStatusTransitionDenial(youli, youliVideo, 'cancelled'), VIDEO_ARCHIVE_DENIED);
  });

  it('still blocks a cameraman who is not supervisor and not the editor', () => {
    const cameraman = actor({ role: 'cameraman', department: 'production_video' });
    assert.equal(videoStatusTransitionDenial(cameraman, none, 'shooting_done'), null);
    assert.equal(videoStatusTransitionDenial(cameraman, none, 'shooting_in_progress'), null);
    assert.equal(videoStatusTransitionDenial(cameraman, none, 'editing'), VIDEO_STAGE_DENIED);
    assert.equal(videoStatusTransitionDenial(cameraman, none, 'sent_to_client'), VIDEO_STAGE_DENIED);
  });

  it('lets an assigned editor move post-production stages even when the role is cameraman', () => {
    const cameraman = actor({ role: 'cameraman', employeeId: YOULI, department: 'production_video' });
    const assigned: VideoStageAssignment = { editorIds: [YOULI], cameramanIds: [] };
    assert.equal(videoStatusTransitionDenial(cameraman, assigned, 'editing'), null);
    assert.equal(videoStatusTransitionDenial(cameraman, assigned, 'sent_to_client'), null);
    assert.equal(videoStatusTransitionDenial(cameraman, assigned, 'published'), null);
  });

  it('lets an editor role move a video through the board, including Livré', () => {
    const editor = actor({ role: 'editor', department: 'production_video' });
    assert.equal(videoStatusTransitionDenial(editor, none, 'editing'), null);
    assert.equal(videoStatusTransitionDenial(editor, none, 'sent_to_client'), null);
    assert.equal(videoStatusTransitionDenial(editor, none, 'published'), null);
    assert.equal(videoStatusTransitionDenial(editor, none, 'archived'), VIDEO_ARCHIVE_DENIED);
  });

  it('gives admin and project manager full stage control', () => {
    for (const role of ['admin', 'project_manager'] as const) {
      const full = actor({ role });
      assert.equal(videoStatusTransitionDenial(full, none, 'published'), null);
      assert.equal(videoStatusTransitionDenial(full, none, 'validated'), null);
      assert.equal(videoStatusTransitionDenial(full, none, 'archived'), null);
    }
  });

  it('keeps a non-video supervisor on their job-role limits', () => {
    const supervisor = actor({
      role: 'community_manager',
      isDepartmentSupervisor: true,
      department: 'community_management',
    });
    assert.equal(videoStatusTransitionDenial(supervisor, none, 'sent_to_client'), null);
    assert.equal(videoStatusTransitionDenial(supervisor, none, 'published'), null);
    const web = actor({
      role: 'developer',
      isDepartmentSupervisor: true,
      department: 'web_seo',
    });
    assert.match(videoStatusTransitionDenial(web, none, 'editing') ?? '', /non autorisée/);
  });

  it('blocks clients and finance', () => {
    assert.match(videoStatusTransitionDenial(actor({ role: 'client' }), none, 'editing') ?? '', /non autorisée/);
    assert.match(videoStatusTransitionDenial(actor({ role: 'finance' }), none, 'editing') ?? '', /non autorisée/);
  });
});
