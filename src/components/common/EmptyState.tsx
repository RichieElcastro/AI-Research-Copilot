import React from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  id?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  academicNote?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  id = 'empty-state-card',
  icon,
  title,
  description,
  academicNote,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs max-w-2xl mx-auto my-6"
    >
      <div className="p-3.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 mb-4 shadow-2xs">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-4">{description}</p>

      {academicNote && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-md mb-6 text-left leading-relaxed">
          <span className="font-semibold text-slate-700">Methodology Note: </span>
          {academicNote}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionLabel && onAction && (
          <button
            type="button"
            id={`${id}-cta`}
            onClick={onAction}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-indigo-400"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            id={`${id}-secondary-cta`}
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
