'use client';

import { loader } from '@monaco-editor/react';

let isConfigured = false;

export function configureMonaco() {
  if (isConfigured || typeof window === 'undefined') {
    return;
  }

  loader.config({
    paths: {
      vs: '/monaco/vs',
    },
  });

  isConfigured = true;
}
