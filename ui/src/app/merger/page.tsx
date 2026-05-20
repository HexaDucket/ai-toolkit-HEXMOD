'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Loader2, AlertCircle, RefreshCw, Combine } from 'lucide-react';
import { TopBar, MainContent } from '@/components/layout';
import { TextInput, SelectInput } from '@/components/formInputs';
import { getFilename } from '@/utils/basic';
import { callScriptStream } from '@/utils/callScript';
import { SelectOption } from '@/types';
import { apiClient } from '@/utils/api';
import useSettings from '@/hooks/useSettings';

interface FileObject {
  path: string;
  size: number;
}

interface SelectedLoRA {
  path: string;
  strength: number;
}

const joinPath = (folder: string, name: string) => {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  const trimmed = folder.replace(/[\\/]+$/, '');
  const suffix = name.endsWith('.safetensors') ? '' : '.safetensors';
  return `${trimmed}${sep}${name}${suffix}`;
};

export default function MergerPage() {
  const { settings, isSettingsLoaded } = useSettings();
  const [availableLoRAs, setAvailableLoRAs] = useState<FileObject[]>([]);
  const [filesStatus, setFilesStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [selectedLoRAs, setSelectedLoRAs] = useState<SelectedLoRA[]>([]);
  const [outputName, setOutputName] = useState('merged_lora');
  const [saveDtype, setSaveDtype] = useState('bfloat16');
  const [device, setDevice] = useState('cpu');

  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [logOutput, setLogOutput] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  const fetchAvailableLoRAs = () => {
    setFilesStatus('loading');
    apiClient
      .get('/api/files/safetensors')
      .then(res => res.data)
      .then(data => {
        if (data.files) {
          setAvailableLoRAs(data.files);
        }
        setFilesStatus('success');
      })
      .catch(error => {
        console.error('Error fetching checkpoints:', error);
        setFilesStatus('error');
      });
  };

  useEffect(() => {
    fetchAvailableLoRAs();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logOutput]);

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning || selectedLoRAs.length === 0 || !outputName || !settings.TRAINING_FOLDER) return;

    setIsRunning(true);
    setIsDone(false);
    setHasError(false);
    setLogOutput('');

    const output = joinPath(settings.TRAINING_FOLDER, outputName);
    const append = (chunk: string) => setLogOutput(prev => prev + chunk);

    try {
      append(`Starting merge process...\n`);
      append(`Output file path: ${output}\n\n`);

      const finalEvent = await callScriptStream('merge_loras.py', {
        args: {
          loras: JSON.stringify(selectedLoRAs),
          output,
          save_dtype: saveDtype,
          device: device,
        },
        onStdout: append,
        onStderr: append,
      });

      const ok = finalEvent?.type === 'exit' && finalEvent.ok === true;
      if (!ok) {
        setHasError(true);
        if (finalEvent?.type === 'error' && finalEvent.message) {
          append(`\nError: ${finalEvent.message}\n`);
        } else if (finalEvent?.type === 'exit' && finalEvent.timedOut) {
          append('\nScript timed out (limit exceeded).\n');
        } else if (finalEvent?.type === 'exit') {
          append(`\nScript exited with code ${finalEvent.exitCode}.\n`);
        }
      } else {
        append(`\nProcess completed successfully!\n`);
      }
    } catch (err: any) {
      setHasError(true);
      append(`\nUnexpected error: ${err?.message || 'Unknown error'}\n`);
    } finally {
      setIsRunning(false);
      setIsDone(true);
    }
  };

  const loraLabel = (path: string) => {
    const filename = getFilename(path);
    const parts = path.split(/[\\/]/);
    if (parts.length >= 2) {
      const parentDir = parts[parts.length - 2];
      return `${parentDir} / ${filename.replace('.safetensors', '')}`;
    }
    return filename.replace('.safetensors', '');
  };

  const selectedPaths = selectedLoRAs.map(s => s.path);

  const options: SelectOption[] = availableLoRAs
    .filter(f => !selectedPaths.includes(f.path))
    .map(f => ({ value: f.path, label: loraLabel(f.path) }));

  const rescale = (items: SelectedLoRA[]): SelectedLoRA[] => {
    if (items.length === 0) return items;
    const strength = Math.round((1 / items.length) * 1000) / 1000;
    return items.map(s => ({ ...s, strength }));
  };

  const addLoRA = (path: string) => {
    if (!path || selectedPaths.includes(path)) return;
    setSelectedLoRAs(prev => rescale([...prev, { path, strength: 0 }]));
  };

  const removeLoRA = (path: string) => {
    setSelectedLoRAs(prev => rescale(prev.filter(s => s.path !== path)));
  };

  const updateStrength = (path: string, strength: number | null) => {
    setSelectedLoRAs(prev => prev.map(s => (s.path === path ? { ...s, strength: strength ?? 0 } : s)));
  };

  const cleanSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <>
      <TopBar>
        <div className="flex items-center space-x-2">
          <Combine className="w-5 h-5 text-purple-500" />
          <h1 className="text-base sm:text-lg font-semibold">LoRA Merger</h1>
        </div>
      </TopBar>

      <MainContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          {/* Column 1 and 2: Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleMerge} className="space-y-6">
              {/* Card 1: General Settings */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-2">
                  Output Settings
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    label="Output Filename"
                    value={outputName}
                    suffix=".safetensors"
                    onChange={value => setOutputName(value)}
                    placeholder="e.g. my_merged_lora"
                    disabled={isRunning}
                    required
                  />

                  <div className="flex flex-col">
                    <label className="block text-xs mb-1 mt-2 text-gray-300">Training Folder Path</label>
                    <div className="text-xs px-3 py-2 bg-gray-950 dark:bg-gray-800 border border-gray-700 rounded-sm text-gray-400 overflow-x-auto whitespace-nowrap min-h-[30px] flex items-center">
                      {!isSettingsLoaded ? 'Loading...' : settings.TRAINING_FOLDER || 'Not defined'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput
                    label="Save Dtype"
                    value={saveDtype}
                    onChange={value => setSaveDtype(value)}
                    disabled={isRunning}
                    options={[
                      { value: 'bfloat16', label: 'bfloat16 (Recommended)' },
                      { value: 'float16', label: 'float16' },
                      { value: 'float32', label: 'float32' },
                    ]}
                  />

                  <SelectInput
                    label="Execution Device"
                    value={device}
                    onChange={value => setDevice(value)}
                    disabled={isRunning}
                    options={[
                      { value: 'cpu', label: 'CPU (Consumes less VRAM)' },
                      { value: 'cuda', label: 'CUDA / GPU (Faster)' },
                    ]}
                  />
                </div>
              </div>

              {/* Card 2: LoRA Selection */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                    LoRA Selection
                  </h2>
                  <button
                    type="button"
                    onClick={fetchAvailableLoRAs}
                    disabled={filesStatus === 'loading' || isRunning}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="Refresh file list"
                  >
                    <RefreshCw className={`w-4 h-4 ${filesStatus === 'loading' ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {filesStatus === 'loading' && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  </div>
                )}

                {filesStatus === 'error' && (
                  <div className="flex items-center justify-center py-6 text-rose-400 space-x-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">Error loading checkpoints. Make sure there are `.safetensors` files in your training folder.</span>
                  </div>
                )}

                {filesStatus === 'success' && (
                  <div className="space-y-4">
                    <SelectInput
                      label="Add LoRA for Merging"
                      multiple={false}
                      value=""
                      onChange={value => addLoRA(value)}
                      disabled={isRunning || options.length === 0}
                      options={options}
                    />

                    {options.length === 0 && availableLoRAs.length > 0 && selectedLoRAs.length === availableLoRAs.length && (
                      <p className="text-xs text-gray-500 italic">All available LoRAs have been added.</p>
                    )}

                    {availableLoRAs.length === 0 && (
                      <p className="text-sm text-amber-500 italic">
                        No checkpoints (.safetensors) found in the training folder. Please complete a training job first!
                      </p>
                    )}

                    {selectedLoRAs.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <label className="block text-xs font-semibold text-gray-300">Selected LoRAs and Weights (Strength)</label>
                        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-3 divide-y divide-gray-900 max-h-96 overflow-y-auto">
                          {selectedLoRAs.map((s, index) => {
                            const fileObj = availableLoRAs.find(f => f.path === s.path);
                            return (
                              <div key={s.path} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${index > 0 ? 'pt-3' : ''}`}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-gray-200 font-medium truncate" title={s.path}>
                                    {loraLabel(s.path)}
                                  </p>
                                  {fileObj && (
                                    <p className="text-xs text-gray-500 mt-0.5">Size: {cleanSize(fileObj.size)}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Weight:</span>
                                    <input
                                      type="number"
                                      value={s.strength}
                                      disabled={isRunning}
                                      onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === '' || raw === '-') return;
                                        const n = Number(raw);
                                        if (!isNaN(n)) updateStrength(s.path, n);
                                      }}
                                      step="0.05"
                                      className="w-20 text-xs px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-100 focus:ring-1 focus:ring-purple-600 focus:outline-none"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    disabled={isRunning}
                                    onClick={() => removeLoRA(s.path)}
                                    className="text-gray-500 hover:text-rose-500 p-1.5 hover:bg-gray-900 rounded-lg transition-all disabled:opacity-40"
                                    aria-label="Remove"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Merge Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isRunning || selectedLoRAs.length === 0 || !outputName}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/40 disabled:text-gray-500 text-white rounded-lg font-medium shadow-lg hover:shadow-purple-500/10 transition-all flex items-center space-x-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Merging...</span>
                    </>
                  ) : (
                    <span>Merge LoRAs</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Column 3: Real-time Logs */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl p-5 h-full flex flex-col min-h-[400px] lg:min-h-[500px]">
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider border-b border-b-gray-800 pb-2 mb-4">
                Console Output
              </h2>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-2 text-xs flex items-center justify-between">
                  <span>Process Status</span>
                  {isRunning && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">Merging</span>}
                  {isDone && !hasError && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Success</span>}
                  {isDone && hasError && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-medium">Error</span>}
                  {!isRunning && !isDone && <span className="text-gray-500 italic">Idle</span>}
                </div>

                <div
                  ref={logRef}
                  className="flex-1 font-mono text-[11px] leading-relaxed p-3 overflow-y-auto rounded-lg bg-black text-gray-200 border border-gray-800 whitespace-pre-wrap break-all h-96 lg:h-auto"
                >
                  {logOutput || 'Awaiting merge process. Select checkpoints, configure weights, and click "Merge LoRAs".\n'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}
