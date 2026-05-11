'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { defaultJobConfig, defaultDatasetConfig, migrateJobConfig } from './jobConfig';
import { clonePresetJobConfig, loadTrainingPresets, saveTrainingPresets, TrainingPreset } from './jobPresets';
import { jobTypeOptions } from './options';
import { JobConfig } from '@/types';
import { objectCopy } from '@/utils/basic';
import { useNestedState, setNestedValue } from '@/utils/hooks';
import { SelectInput, TextInput } from '@/components/formInputs';
import useSettings from '@/hooks/useSettings';
import useGPUInfo from '@/hooks/useGPUInfo';
import useDatasetList from '@/hooks/useDatasetList';
import YAML from 'yaml';
import path from 'path';
import { TopBar, MainContent } from '@/components/layout';
import { Button } from '@headlessui/react';
import { FaChevronLeft } from 'react-icons/fa';
import SimpleJob from './SimpleJob';
import AdvancedConfigEditor from '@/components/AdvancedConfigEditor';
import ErrorBoundary from '@/components/ErrorBoundary';
import { apiClient } from '@/utils/api';
import { FilePlus2, FolderOpen, Save, PencilLine, Trash2 } from 'lucide-react';

const isDev = process.env.NODE_ENV === 'development';

function createPresetId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `preset_${Date.now()}`;
}

export default function TrainingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('id');
  const cloneId = searchParams.get('cloneId');
  const [gpuIDs, setGpuIDs] = useState<string | null>(null);
  const { settings, isSettingsLoaded } = useSettings();
  const { gpuList, isGPUInfoLoaded } = useGPUInfo();
  const { datasets, status: datasetFetchStatus } = useDatasetList();
  const [datasetOptions, setDatasetOptions] = useState<{ value: string; label: string }[]>([]);
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [presets, setPresets] = useState<TrainingPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');

  const [jobConfig, setJobConfig] = useNestedState<JobConfig>(objectCopy(migrateJobConfig(defaultJobConfig)));
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyRequiredFields = (config: any, preserveName = true) => {
    const parsed = objectCopy(config);

    try {
      parsed.config.process[0].sqlite_db_path = './aitk_db.db';
      parsed.config.process[0].training_folder = settings.TRAINING_FOLDER;
      parsed.config.process[0].device = 'cuda';
      parsed.config.process[0].performance_log_every = 10;
    } catch (err) {
      console.warn('Could not set required fields on config:', err);
    }

    const migrated = migrateJobConfig(parsed);
    if (!preserveName && migrated?.config?.name) {
      migrated.config.name = `${migrated.config.name}_copy`;
    }
    return migrated;
  };

  const persistPresetList = (nextPresets: TrainingPreset[]) => {
    const sorted = [...nextPresets].sort((a, b) => a.name.localeCompare(b.name));
    setPresets(sorted);
    saveTrainingPresets(sorted);
  };

  const handleImportConfig = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        let parsed: any;
        if (file.name.endsWith('.json') || file.name.endsWith('.jsonc')) {
          parsed = JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
        } else {
          parsed = YAML.parse(text);
        }
        setJobConfig(applyRequiredFields(parsed));
      } catch (err) {
        console.error('Failed to parse config file:', err);
        alert('Failed to parse config file. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  const handleLoadPreset = () => {
    const preset = presets.find(item => item.id === selectedPresetId);
    if (!preset) {
      alert('Selecione uma predefinicao para carregar.');
      return;
    }

    setPresetName(preset.name);
    setJobConfig(applyRequiredFields(clonePresetJobConfig(preset.jobConfig)));
  };

  const handleSavePreset = (mode: 'create' | 'update') => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      alert('Digite um nome para a predefinicao.');
      return;
    }

    const existing = presets.find(item => item.id === selectedPresetId);
    if (mode === 'update' && !existing) {
      alert('Selecione uma predefinicao para atualizar.');
      return;
    }

    if (mode === 'create' && presets.some(item => item.name === trimmedName)) {
      alert('Ja existe uma predefinicao com esse nome.');
      return;
    }

    if (mode === 'update' && presets.some(item => item.name === trimmedName && item.id !== selectedPresetId)) {
      alert('Ja existe outra predefinicao com esse nome.');
      return;
    }

    const now = new Date().toISOString();
    const preset: TrainingPreset = {
      id: existing?.id ?? createPresetId(),
      name: trimmedName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      jobConfig: clonePresetJobConfig(jobConfig),
    };

    const nextPresets = mode === 'update'
      ? presets.map(item => (item.id === preset.id ? preset : item))
      : [...presets, preset];

    persistPresetList(nextPresets);
    setSelectedPresetId(preset.id);
    setPresetName(preset.name);
  };

  const handleDeletePreset = () => {
    const preset = presets.find(item => item.id === selectedPresetId);
    if (!preset) {
      alert('Selecione uma predefinicao para deletar.');
      return;
    }

    if (!window.confirm(`Deletar a predefinicao "${preset.name}"?`)) {
      return;
    }

    const nextPresets = presets.filter(item => item.id !== preset.id);
    persistPresetList(nextPresets);
    setSelectedPresetId('');
    setPresetName('');
  };

  const handleNewPresetDraft = () => {
    setSelectedPresetId('');
    setPresetName(jobConfig.config.name || '');
  };

  useEffect(() => {
    setPresets(loadTrainingPresets());
  }, []);

  useEffect(() => {
    if (!selectedPresetId) {
      return;
    }

    const preset = presets.find(item => item.id === selectedPresetId);
    if (!preset) {
      setSelectedPresetId('');
      return;
    }

    setPresetName(preset.name);
  }, [selectedPresetId, presets]);

  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (datasetFetchStatus !== 'success') return;

    const datasetOptions = datasets.map(name => ({ value: path.join(settings.DATASETS_FOLDER, name), label: name }));
    setDatasetOptions(datasetOptions);

    if (datasetOptions.length > 0) {
      const defaultDatasetPath = defaultDatasetConfig.folder_path;
      // Use functional updater so we check the *current* state, not a stale closure
      setJobConfig((prev: JobConfig) => {
        let updated = prev;
        for (let i = 0; i < prev.config.process[0].datasets.length; i++) {
          if (prev.config.process[0].datasets[i].folder_path === defaultDatasetPath) {
            updated = setNestedValue(updated, datasetOptions[0].value, `config.process[0].datasets[${i}].folder_path`);
          }
        }
        return updated;
      });
    }
  }, [datasets, settings, isSettingsLoaded, datasetFetchStatus]);

  // clone existing job
  useEffect(() => {
    if (cloneId) {
      apiClient
        .get(`/api/jobs?id=${cloneId}`)
        .then(res => res.data)
        .then(data => {
          console.log('Clone Training:', data);
          setGpuIDs(data.gpu_ids);
          const newJobConfig = applyRequiredFields(JSON.parse(data.job_config), false);
          setJobConfig(newJobConfig);
        })
        .catch(error => console.error('Error fetching training:', error));
    }
  }, [cloneId]);

  useEffect(() => {
    if (runId) {
      apiClient
        .get(`/api/jobs?id=${runId}`)
        .then(res => res.data)
        .then(data => {
          console.log('Training:', data);
          setGpuIDs(data.gpu_ids);
          setJobConfig(applyRequiredFields(JSON.parse(data.job_config)));
        })
        .catch(error => console.error('Error fetching training:', error));
    }
  }, [runId]);

  useEffect(() => {
    if (isGPUInfoLoaded) {
      if (gpuIDs === null && gpuList.length > 0) {
        setGpuIDs(`${gpuList[0].index}`);
      }
    }
  }, [gpuList, isGPUInfoLoaded]);

  useEffect(() => {
    if (isSettingsLoaded) {
      setJobConfig(settings.TRAINING_FOLDER, 'config.process[0].training_folder');
    }
  }, [settings, isSettingsLoaded]);

  const saveJob = async () => {
    if (status === 'saving') return;
    setStatus('saving');

    apiClient
      .post('/api/jobs', {
        id: runId,
        name: jobConfig.config.name,
        gpu_ids: gpuIDs,
        job_config: jobConfig,
      })
      .then(res => {
        setStatus('success');
        if (runId) {
          router.push(`/jobs/${runId}`);
        } else {
          router.push(`/jobs/${res.data.id}`);
        }
      })
      .catch(error => {
        if (error.response?.status === 409) {
          alert('Training name already exists. Please choose a different name.');
        } else {
          alert('Failed to save job. Please try again.');
        }
        console.log('Error saving training:', error);
      })
      .finally(() =>
        setTimeout(() => {
          setStatus('idle');
        }, 2000),
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveJob();
  };

  const presetSelectOptions = [
    { value: '', label: 'Preset' },
    ...presets.map(preset => ({
      value: preset.id,
      label: preset.name,
    })),
  ];

  const presetIconButtonClass =
    'h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors';

  return (
    <>
      <TopBar>
        <div>
          <Button className="text-gray-500 dark:text-gray-300 px-3 mt-1" onClick={() => history.back()}>
            <FaChevronLeft />
          </Button>
        </div>
        <div>
          <h1 className="text-lg">{runId ? 'Edit Training Job' : 'New Training Job'}</h1>
        </div>
        <div className="flex-1"></div>
        {showAdvancedView && (
          <>
            <div>
              <SelectInput
                value={`${gpuIDs}`}
                onChange={value => setGpuIDs(value)}
                options={gpuList.map((gpu: any) => ({ value: `${gpu.index}`, label: `GPU #${gpu.index}` }))}
              />
            </div>
            <div className="mx-4 bg-gray-200 dark:bg-gray-800 w-1 h-6"></div>
            <div>
              <Button className="text-gray-200 bg-gray-800 px-3 py-1 rounded-md" onClick={handleImportConfig}>
                Import Config
              </Button>
            </div>
            <div className="mx-4 bg-gray-200 dark:bg-gray-800 w-1 h-6"></div>
          </>
        )}
        {!showAdvancedView && (
          <>
            <div>
              <SelectInput
                value={`${jobConfig?.config.process[0].type}`}
                onChange={value => {
                  // undo current job type changes
                  const currentOption = jobTypeOptions.find(
                    option => option.value === jobConfig?.config.process[0].type,
                  );
                  if (currentOption && currentOption.onDeactivate) {
                    setJobConfig(currentOption.onDeactivate(objectCopy(jobConfig)));
                  }
                  const option = jobTypeOptions.find(option => option.value === value);
                  if (option) {
                    if (option.onActivate) {
                      setJobConfig(option.onActivate(objectCopy(jobConfig)));
                    }
                    jobTypeOptions.forEach(opt => {
                      if (opt.value !== option.value && opt.onDeactivate) {
                        setJobConfig(opt.onDeactivate(objectCopy(jobConfig)));
                      }
                    });
                  }
                  setJobConfig(value, 'config.process[0].type');
                }}
                options={jobTypeOptions}
              />
            </div>
            <div className="mx-4 bg-gray-200 dark:bg-gray-800 w-1 h-6"></div>
          </>
        )}

        <div className="flex items-center gap-2 px-2">
          <div className="w-36">
            <SelectInput
              value={selectedPresetId}
              onChange={value => setSelectedPresetId(value)}
              options={presetSelectOptions}
            />
          </div>
          <div className="w-40">
            <TextInput
              value={presetName}
              onChange={setPresetName}
              placeholder="Nome do preset"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 px-2">
          <Button className={presetIconButtonClass} onClick={handleLoadPreset} title="Carregar preset selecionado">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            className={presetIconButtonClass}
            onClick={() => handleSavePreset('create')}
            title="Salvar preset novo com o nome informado"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            className={presetIconButtonClass}
            onClick={() => handleSavePreset('update')}
            title="Atualizar o preset selecionado"
          >
            <PencilLine className="h-4 w-4" />
          </Button>
          <Button className={presetIconButtonClass} onClick={handleNewPresetDraft} title="Criar novo rascunho de preset">
            <FilePlus2 className="h-4 w-4" />
          </Button>
          <Button
            className={`${presetIconButtonClass} text-red-300 hover:bg-red-900/40`}
            onClick={handleDeletePreset}
            title="Deletar preset selecionado"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-2 bg-gray-200 dark:bg-gray-800 w-1 h-6"></div>

        <div className="pr-2">
          <Button
            className="text-gray-200 bg-gray-800 px-3 py-1 rounded-md"
            onClick={() => setShowAdvancedView(!showAdvancedView)}
          >
            {showAdvancedView ? 'Show Simple' : 'Show Advanced'}
          </Button>
        </div>
        <div>
          <Button
            className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md"
            onClick={() => saveJob()}
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : runId ? 'Update Job' : 'Create Job'}
          </Button>
        </div>
      </TopBar>

      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,.jsonc"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {showAdvancedView ? (
        <div className="pt-14 px-4 absolute top-0 left-0 w-full h-full overflow-auto">
          <div className="h-[calc(100vh-4.5rem)] min-h-[32rem] overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
            <AdvancedConfigEditor
              config={jobConfig}
              setConfig={setJobConfig}
              transformOnParse={(parsed: any) => {
                try {
                  parsed.config.process[0].sqlite_db_path = './aitk_db.db';
                  parsed.config.process[0].training_folder = settings.TRAINING_FOLDER;
                  parsed.config.process[0].device = 'cuda';
                  parsed.config.process[0].performance_log_every = 10;
                } catch (e) {
                  console.warn(e);
                }
                return migrateJobConfig(parsed);
              }}
            />
          </div>
        </div>
      ) : (
        <MainContent>
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-64 text-lg text-red-600 font-medium bg-red-100 dark:bg-red-900/20 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg">
                Advanced job detected. Please switch to advanced view to continue.
              </div>
            }
          >
            <SimpleJob
              jobConfig={jobConfig}
              setJobConfig={setJobConfig}
              status={status}
              handleSubmit={handleSubmit}
              runId={runId}
              gpuIDs={gpuIDs}
              setGpuIDs={setGpuIDs}
              gpuList={gpuList}
              datasetOptions={datasetOptions}
              isLoading={!isSettingsLoaded || !isGPUInfoLoaded || datasetFetchStatus !== 'success'}
            />
          </ErrorBoundary>

          <div className="pt-20"></div>
        </MainContent>
      )}
    </>
  );
}
