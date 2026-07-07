import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbItems?: BreadcrumbItem[];
}

export const PageHeader = ({
  title,
  description,
  actions,
  breadcrumbItems,
}: PageHeaderProps) => {
  return (
    <div className="mb-6 space-y-2">
      {/* Breadcrumbs */}
      {breadcrumbItems && breadcrumbItems.length > 0 && (
        <nav className="flex items-center space-x-1.5 text-xs font-medium text-slate-500 mb-2" aria-label="Breadcrumb">
          <Link
            to="/"
            className="flex items-center gap-1 hover:text-brand-600 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Hoje</span>
          </Link>
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
              {item.to ? (
                <Link
                  to={item.to}
                  className="hover:text-brand-600 transition-colors truncate max-w-[150px] sm:max-w-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-slate-800 font-semibold truncate max-w-[150px] sm:max-w-none">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
