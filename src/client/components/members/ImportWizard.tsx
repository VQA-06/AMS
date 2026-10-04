import React, { useState } from 'react';
import Papa from 'papaparse';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Warning } from '@phosphor-icons/react/Warning';
import { fetchApi } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Table, THead, TBody, TRow, TCell } from '../ui/Table';

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';


const FILE_INPUT_ID = 'import-wizard-field-1';

interface ImportWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [mode, setMode] = useState<'upsert' | 'create' | 'update'>('upsert');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, unknown>>>([]);
  const [previewReport, setPreviewReport] = useState<{
    total: number;
    validCount: number;
    invalidCount: number;
    results: Array<{
      row: number;
      valid: boolean;
      data?: Record<string, unknown>;
      errors?: Array<{ field: string; message: string }>;
    }>;
  } | null>(null);
  const [commitResult, setCommitResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Download template CSV
  const handleDownloadTemplate = () => {
    window.open('/api/members/template.csv', '_blank');
  };

  // Handle file select. `Field` owns the control, so the reader pulls the picked
  // file back off the input it rendered rather than from a change event.
  const handleFileChange = () => {
    const input = document.getElementById(FILE_INPUT_ID);
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) return;
    setError(null);

    const isJson = file.name.endsWith('.json');

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          const rows = Array.isArray(content) ? content : content.members || [];
          if (!Array.isArray(rows) || rows.length === 0) {
            setError('File JSON tidak memuat data anggota yang valid.');
            return;
          }
          setParsedRows(rows);
          runPreview(rows);
        } catch {
          setError('Gagal membaca format file JSON.');
        }
      };
      reader.readAsText(file);
    } else {
      // Parse CSV
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            setError('File CSV kosong atau tidak memiliki baris data.');
            return;
          }
          setParsedRows(results.data);
          runPreview(results.data);
        },
        error: () => {
          setError('Gagal memproses file CSV.');
        },
      });
    }
  };

  const runPreview = async (rows: Array<Record<string, unknown>>) => {
    setLoading(true);
    setError(null);
    try {
      const report = await fetchApi<{
        total: number;
        validCount: number;
        invalidCount: number;
        results: Array<{
          row: number;
          valid: boolean;
          data?: Record<string, unknown>;
          errors?: Array<{ field: string; message: string }>;
        }>;
      }>('/api/members/import', {
        method: 'POST',
        body: JSON.stringify({ mode, preview: true, rows }),
      });

      setPreviewReport(report);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memvalidasi data import.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!parsedRows.length) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchApi<{
        total: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
      }>('/api/members/import', {
        method: 'POST',
        body: JSON.stringify({ mode, preview: false, rows: parsedRows }),
      });

      setCommitResult(result);
      setStep('result');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengimpor data ke server.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface mx-auto max-w-4xl space-y-5 rounded-panel p-4 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-ink">
            Import Data Anggota (CSV / JSON)
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Unggah data massal anggota lengkap dengan kolom divisi
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<DownloadSimple className="w-4 h-4 text-ink-2" />}
          onClick={handleDownloadTemplate}
        >
          Download Template CSV
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-panel border border-pen-200 bg-pen-50/70 p-4 text-xs text-pen-deep"
        >
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Mode Selector */}
          <fieldset>
            <legend className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-ink-2">
              Mode Penanganan Duplikasi ID (external_id):
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  { value: 'upsert', title: 'Upsert (Direkomendasikan)', body: 'Insert jika baru, update data jika ID sudah ada.' },
                  { value: 'create', title: 'Create Only', body: 'Hanya insert anggota baru, abaikan ID yang sudah ada.' },
                  { value: 'update', title: 'Update Only', body: 'Hanya update anggota yang sudah terdaftar.' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'cursor-pointer rounded-panel border p-3.5 transition-colors duration-120 ease-out-expo',
                    focusRing,
                    mode === opt.value
                      ? 'border-pen-500 bg-pen-50/70 text-ink'
                      : 'border-rule-strong bg-paper-raised/40 text-ink-2 hover:bg-paper-raised'
                  )}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="sr-only"
                  />
                  <p className="text-xs font-bold">{opt.title}</p>
                  <p className="mt-1 text-[11px] text-ink-2">{opt.body}</p>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Drag and Drop Zone */}
          <Field
            id={FILE_INPUT_ID}
            label="Berkas CSV / JSON"
            control="file"
            accept=".csv,.json"
            value=""
            onChange={handleFileChange}
            hint="Format kolom: external_id, name, email, phone, group_name, division, status, metadata"
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Validation Table */}
      {step === 'preview' && previewReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="surface rounded-panel p-3.5">
              <span className="text-[10px] font-semibold uppercase text-ink-2">Total Baris</span>
              <p className="font-oxanium text-lg font-bold text-ink">{previewReport.total}</p>
            </div>
            <div className="rounded-panel border border-seal-200 bg-seal-50/70 p-3.5">
              <span className="text-[10px] font-semibold uppercase text-seal-600">Valid</span>
              <p className="font-oxanium text-lg font-bold text-seal-800">{previewReport.validCount}</p>
            </div>
            <div className="rounded-panel border border-pen-200 bg-pen-50/70 p-3.5">
              <span className="text-[10px] font-semibold uppercase text-pen-600">Bermasalah</span>
              <p className="font-oxanium text-lg font-bold text-pen-deep">
                {previewReport.invalidCount}
              </p>
            </div>
          </div>

          {/* Table of Rows */}
          <div className="surface max-h-72 overflow-auto rounded-panel">
            <Table>
              <THead>
                <tr>
                  <TCell header>Baris</TCell>
                  <TCell header>Status</TCell>
                  <TCell header>Kode</TCell>
                  <TCell header>Nama</TCell>
                  <TCell header>Divisi</TCell>
                  <TCell header>Catatan / Error</TCell>
                </tr>
              </THead>
              <TBody className="font-oxanium">
                {previewReport.results.map((res) => (
                  <TRow
                    key={res.row}
                    className={cn(
                      res.valid ? 'hover:bg-paper-raised/50' : 'bg-pen-50/70 text-pen-deep'
                    )}
                  >
                    <TCell>{res.row}</TCell>
                    <TCell>
                      {res.valid ? (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-seal-600">
                          <CheckCircle className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-pen-600">
                          <Warning className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </TCell>
                    <TCell truncate className="font-semibold">
                      {(res.data?.external_id as string) || '-'}
                    </TCell>
                    <TCell truncate className="font-sans font-medium">
                      {(res.data?.name as string) || '-'}
                    </TCell>
                    <TCell className="font-sans">
                      {res.data?.division ? (
                        <span className="inline-flex items-center gap-1 rounded-chip border border-rule-strong bg-paper-raised px-2 py-0.5 text-[11px] text-ink">
                          <Buildings className="w-3 h-3 shrink-0 text-ink-2" />
                          <span>{res.data.division as string}</span>
                        </span>
                      ) : (
                        <span className="text-ink-2">-</span>
                      )}
                    </TCell>
                    <TCell truncate className="font-sans text-[11px]">
                      {res.valid ? (
                        <span className="text-ink-2">Siap diimpor</span>
                      ) : (
                        <span className="font-semibold text-pen-600">
                          {res.errors?.map((e) => `${e.field}: ${e.message}`).join(', ')}
                        </span>
                      )}
                    </TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-rule pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep('upload')}
            >
              Kembali Pilih File
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={loading || previewReport.validCount === 0}
              loading={loading}
              loadingText="Mengimpor Data..."
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={handleCommit}
            >
              {`Commit Import (${previewReport.validCount} Baris)`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result Summary */}
      {step === 'result' && commitResult && (
        <div className="space-y-6 py-6 text-center">
          <div className="pop-once mx-auto flex h-16 w-16 items-center justify-center rounded-panel border border-seal-200 bg-seal-50/70 text-seal-800">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading text-xl font-bold text-ink">Proses Import Selesai</h3>
            <p className="mt-1 text-xs text-ink-2">
              Ringkasan hasil import data anggota ke database D1
            </p>
          </div>

          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="surface rounded-panel p-3.5">
              <span className="text-[10px] font-semibold uppercase text-ink-2">Dibuat</span>
              <p className="font-oxanium text-lg font-bold text-seal-600">+{commitResult.created}</p>
            </div>
            <div className="surface rounded-panel p-3.5">
              <span className="text-[10px] font-semibold uppercase text-ink-2">Diperbarui</span>
              <p className="font-oxanium text-lg font-bold text-ink-2">{commitResult.updated}</p>
            </div>
            <div className="surface rounded-panel p-3.5">
              <span className="text-[10px] font-semibold uppercase text-ink-2">Dilewati</span>
              <p className="font-oxanium text-lg font-bold text-ink-2">{commitResult.skipped}</p>
            </div>
            <div className="surface rounded-panel p-3.5">
              <span className="text-[10px] font-semibold uppercase text-ink-2">Gagal</span>
              <p className="font-oxanium text-lg font-bold text-pen-deep">{commitResult.failed}</p>
            </div>
          </div>

          <div className="pt-4">
            <Button type="button" variant="primary" size="md" onClick={onSuccess}>
              Lihat Daftar Anggota
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
