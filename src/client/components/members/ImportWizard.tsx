import React, { useState } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { fetchApi } from '../../lib/api-client';

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

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    <div className="glass-panel-elevated rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-700/60 shadow-2xl max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="font-heading font-bold text-xl text-white">Import Data Anggota (CSV / JSON)</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Unggah data massal anggota lengkap dengan kolom divisi
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-400 transition-colors shadow"
        >
          <Download className="w-4 h-4" />
          <span>Download Template CSV</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Mode Penanganan Duplikasi ID (external_id):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'upsert'
                    ? 'bg-sky-500/20 border-sky-500 text-white'
                    : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  value="upsert"
                  checked={mode === 'upsert'}
                  onChange={() => setMode('upsert')}
                  className="hidden"
                />
                <p className="font-bold text-xs">Upsert (Direkomendasikan)</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Insert jika baru, update data jika ID sudah ada.
                </p>
              </label>

              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'create'
                    ? 'bg-sky-500/20 border-sky-500 text-white'
                    : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  value="create"
                  checked={mode === 'create'}
                  onChange={() => setMode('create')}
                  className="hidden"
                />
                <p className="font-bold text-xs">Create Only</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hanya insert baru, lewati baris yang sudah ada.
                </p>
              </label>

              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  mode === 'update'
                    ? 'bg-sky-500/20 border-sky-500 text-white'
                    : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  value="update"
                  checked={mode === 'update'}
                  onChange={() => setMode('update')}
                  className="hidden"
                />
                <p className="font-bold text-xs">Update Only</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hanya update anggota yang sudah terdaftar.
                </p>
              </label>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-3xl p-8 text-center bg-slate-900/40 transition-colors relative">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/10">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                Klik atau Tarik File CSV / JSON ke Sini
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Format kolom: <code className="text-sky-400">external_id, name, email, phone, group_name, division, status, metadata</code>
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Validation Table */}
      {step === 'preview' && previewReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Baris</span>
              <p className="text-lg font-bold text-white">{previewReport.total}</p>
            </div>
            <div className="glass-panel p-3.5 rounded-2xl border border-emerald-900/40 bg-emerald-950/20">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Valid</span>
              <p className="text-lg font-bold text-emerald-400">{previewReport.validCount}</p>
            </div>
            <div className="glass-panel p-3.5 rounded-2xl border border-rose-900/40 bg-rose-950/20">
              <span className="text-[10px] text-rose-400 uppercase font-semibold">Bermasalah</span>
              <p className="text-lg font-bold text-rose-400">{previewReport.invalidCount}</p>
            </div>
          </div>

          {/* Table of Rows */}
          <div className="glass-panel rounded-2xl border border-slate-800 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 sticky top-0 uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5">Baris</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Kode</th>
                  <th className="px-3.5 py-2.5">Nama</th>
                  <th className="px-3.5 py-2.5">Divisi</th>
                  <th className="px-3.5 py-2.5">Catatan / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {previewReport.results.map((res) => (
                  <tr
                    key={res.row}
                    className={res.valid ? 'hover:bg-slate-900/40' : 'bg-rose-950/20 text-rose-300'}
                  >
                    <td className="px-3.5 py-2">{res.row}</td>
                    <td className="px-3.5 py-2">
                      {res.valid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-sans font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-sans font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 font-semibold">
                      {(res.data?.external_id as string) || '-'}
                    </td>
                    <td className="px-3.5 py-2 font-sans font-medium">
                      {(res.data?.name as string) || '-'}
                    </td>
                    <td className="px-3.5 py-2 font-sans">
                      {res.data?.division ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/40 text-[11px]">
                          <Building2 className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>{res.data.division as string}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-[11px] font-sans">
                      {res.valid ? (
                        <span className="text-slate-400">Siap diimpor</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">
                          {res.errors?.map((e) => `${e.field}: ${e.message}`).join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Kembali Pilih File
            </button>
            <button
              onClick={handleCommit}
              disabled={loading || previewReport.validCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <span>{loading ? 'Mengimpor Data...' : `Commit Import (${previewReport.validCount} Baris)`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result Summary */}
      {step === 'result' && commitResult && (
        <div className="space-y-6 text-center py-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-xl font-bold font-heading text-white">Proses Import Selesai</h4>
            <p className="text-xs text-slate-400 mt-1">Ringkasan hasil import data anggota ke database D1</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Dibuat</span>
              <p className="text-lg font-bold text-emerald-400">+{commitResult.created}</p>
            </div>
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Diperbarui</span>
              <p className="text-lg font-bold text-sky-400">{commitResult.updated}</p>
            </div>
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Dilewati</span>
              <p className="text-lg font-bold text-slate-400">{commitResult.skipped}</p>
            </div>
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Gagal</span>
              <p className="text-lg font-bold text-rose-400">{commitResult.failed}</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={onSuccess}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              Lihat Daftar Anggota
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
