import { config } from './config.js';
import { supabase } from './supabase.js';
import { ensureDir } from './storage.js';
import {
  completeJob,
  failJob,
  setJobProgress,
  updateSource,
} from './db.js';
import { handleProcessingJob, handleRenderJob, type JobLike, type RenderJobLike } from './pipeline.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ProcessingJobRow extends JobLike {
  attempts: number;
  max_attempts: number;
}
interface RenderJobRow extends RenderJobLike {
  attempts: number;
  max_attempts: number;
}

async function claimProcessingJob(): Promise<ProcessingJobRow | null> {
  const { data, error } = await supabase.rpc('claim_processing_job', { p_worker: config.workerId });
  if (error) throw new Error(`claim_processing_job: ${error.message}`);
  // A composite-returning RPC yields an all-null row (not JS null) when empty.
  const row = data as ProcessingJobRow | null;
  return row && row.id ? row : null;
}

async function claimRenderJob(): Promise<RenderJobRow | null> {
  const { data, error } = await supabase.rpc('claim_render_job', { p_worker: config.workerId });
  if (error) throw new Error(`claim_render_job: ${error.message}`);
  const row = data as RenderJobRow | null;
  return row && row.id ? row : null;
}

async function runOnce(): Promise<boolean> {
  // Prefer renders (user is actively waiting on an export) then pipeline jobs.
  const render = await claimRenderJob();
  if (render) {
    console.info(`[render] claim ${render.id} clip=${render.clip_id}`);
    try {
      await handleRenderJob(render, async (pct) => {
        await setJobProgress('render_jobs', render.id, pct);
      });
      await completeJob('render_jobs', render.id);
      console.info(`[render] done ${render.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[render] fail ${render.id}: ${msg}`);
      await failJob('render_jobs', render.id, render.attempts, render.max_attempts, msg);
    }
    return true;
  }

  const job = await claimProcessingJob();
  if (job) {
    console.info(`[job] claim ${job.id} type=${job.job_type} source=${job.source_video_id}`);
    try {
      await handleProcessingJob(job);
      await completeJob('processing_jobs', job.id);
      console.info(`[job] done ${job.id} (${job.job_type})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[job] fail ${job.id} (${job.job_type}): ${msg}`);
      const giveUp = await failJob('processing_jobs', job.id, job.attempts, job.max_attempts, msg);
      if (giveUp && job.source_video_id) {
        await updateSource(job.source_video_id, { status: 'failed', error_message: msg.slice(0, 500) });
      }
    }
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  await ensureDir(config.workDir);
  console.info(
    `[worker] ${config.workerId} started — whisper=${config.whisperModel} model=${config.aiModel} poll=${config.pollIntervalMs}ms`,
  );

  let running = true;
  const shutdown = (sig: string) => {
    console.info(`[worker] ${sig} received — finishing current loop then exiting.`);
    running = false;
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  while (running) {
    let didWork = false;
    try {
      didWork = await runOnce();
    } catch (e) {
      console.error('[worker] loop error:', e instanceof Error ? e.message : e);
    }
    if (!didWork) await sleep(config.pollIntervalMs);
  }

  console.info('[worker] stopped.');
  process.exit(0);
}

void main();
