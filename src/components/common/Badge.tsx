import React from 'react';
import { MeasurementScale, ProjectStatus, VariableRole } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
  size?: 'xs' | 'sm';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'xs',
  className = '',
}) => {
  const variantStyles = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };

  const sizeStyles = {
    xs: 'text-[11px] px-2 py-0.5 font-medium',
    sm: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const map: Record<ProjectStatus, { variant: BadgeProps['variant']; label: string }> = {
    Draft: { variant: 'slate', label: 'Draft Design' },
    'Data Collection': { variant: 'indigo', label: 'Data Collection' },
    Analysis: { variant: 'purple', label: 'Statistical Analysis' },
    Completed: { variant: 'emerald', label: 'Completed' },
    Archived: { variant: 'amber', label: 'Archived' },
  };

  const info = map[status] || { variant: 'slate', label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
};

export const VariableRoleBadge: React.FC<{ role: VariableRole }> = ({ role }) => {
  const map: Record<VariableRole, { variant: BadgeProps['variant']; code: string }> = {
    'Independent Variable': { variant: 'indigo', code: 'Predictor (IV)' },
    'Dependent Variable': { variant: 'emerald', code: 'Outcome (DV)' },
    'Control Variable': { variant: 'amber', code: 'Control (CV)' },
    'Demographic Variable': { variant: 'cyan', code: 'Demographic' },
    Other: { variant: 'slate', code: 'Other' },
  };

  const info = map[role] || { variant: 'slate', code: role };
  return <Badge variant={info.variant}>{info.code}</Badge>;
};

export const MeasurementScaleBadge: React.FC<{ scale: MeasurementScale }> = ({ scale }) => {
  const map: Record<MeasurementScale, { variant: BadgeProps['variant']; label: string }> = {
    Nominal: { variant: 'slate', label: 'Nominal Scale' },
    Ordinal: { variant: 'cyan', label: 'Ordinal Scale' },
    Interval: { variant: 'purple', label: 'Interval Scale' },
    Ratio: { variant: 'emerald', label: 'Ratio Scale' },
  };

  const info = map[scale] || { variant: 'slate', label: scale };
  return <Badge variant={info.variant}>{info.label}</Badge>;
};
