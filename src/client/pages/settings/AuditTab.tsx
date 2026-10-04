import React from 'react';
import { AuditLog } from '@/shared/types';
import { Card } from '../../components/ui/Card';
import { Table, THead, TBody, TRow, TCell } from '../../components/ui/Table';

interface AuditTabProps {
  logs: AuditLog[];
}

/**
 * The audit trail stays a table on purpose, unlike the other settings tabs. It
 * is scanned by timestamp and actor rather than browsed as a list of things,
 * and four aligned columns are what make an audit log trustworthy at a glance.
 * There is no per-row action that could collapse into a RowList.
 */
export const AuditTab: React.FC<AuditTabProps> = ({ logs }) => {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <THead>
            <tr>
              <TCell header>Waktu</TCell>
              <TCell header>Aksi</TCell>
              <TCell header>Pelaksana</TCell>
              <TCell header>Detail</TCell>
            </tr>
          </THead>
          <TBody>
            {logs.map((log) => (
              <TRow key={log.id}>
                <TCell className="whitespace-nowrap font-oxanium text-ink-2">
                  {new Date(log.created_at).toLocaleString('id-ID')}
                </TCell>
                <TCell truncate className="font-semibold text-ink-2">
                  {log.action}
                </TCell>
                <TCell truncate className="text-ink">
                  {log.admin_name || log.admin_email || 'Sistem / Dev'}
                </TCell>
                <TCell truncate className="font-oxanium text-ink-2">
                  {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta)}
                </TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
};