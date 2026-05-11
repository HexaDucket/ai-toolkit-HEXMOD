'use client';

import { JobConfig } from '@/types';
import { objectCopy } from '@/utils/basic';

export const TRAINING_PRESETS_STORAGE_KEY = 'aitk_training_presets_v1';

export interface TrainingPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  jobConfig: JobConfig;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadTrainingPresets(): TrainingPreset[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TRAINING_PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is TrainingPreset => Boolean(item?.id && item?.name && item?.jobConfig))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to load training presets:', error);
    return [];
  }
}

export function saveTrainingPresets(presets: TrainingPreset[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TRAINING_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function clonePresetJobConfig(jobConfig: JobConfig) {
  return objectCopy(jobConfig);
}
