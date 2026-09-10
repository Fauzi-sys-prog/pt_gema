import React from 'react';

interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ResponsiveCard({ children, className = '', noPadding = false }: ResponsiveCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${!noPadding ? 'p-4 lg:p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveGrid({ children, cols = 3, gap = 'md', className = '' }: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4 lg:gap-6',
    lg: 'gap-6 lg:gap-8'
  };

  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${colClasses[cols]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveStackProps {
  children: React.ReactNode;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveStack({ children, gap = 'md', className = '' }: ResponsiveStackProps) {
  const gapClasses = {
    sm: 'space-y-3',
    md: 'space-y-4 lg:space-y-6',
    lg: 'space-y-6 lg:space-y-8'
  };

  return (
    <div className={`${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export function ResponsiveContainer({ children, maxWidth = 'full', className = '' }: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  };

  return (
    <div className={`${maxWidthClasses[maxWidth]} mx-auto w-full ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  onClick?: () => void;
}

export function StatCard({ title, value, icon, trend, subtitle, color = 'blue', onClick }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  };

  const baseClasses = onClick 
    ? 'cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]'
    : '';

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-5 ${baseClasses}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs lg:text-sm text-gray-600 mb-1 truncate">{title}</p>
          <p className="text-xl lg:text-2xl font-bold text-gray-900 mb-1 break-words">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={`inline-flex items-center text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center flex-shrink-0 ml-3`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
}

export function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-4 lg:mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-500 mb-2 overflow-x-auto pb-1">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span>/</span>}
              <span className={crumb.path ? 'hover:text-blue-600 cursor-pointer whitespace-nowrap' : 'whitespace-nowrap'}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
  return (
    <div className="overflow-x-auto -mx-4 lg:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
            {children}
          </table>
        </div>
      </div>
    </div>
  );
}

interface MobileCardListItemProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function MobileCardListItem({ 
  title, 
  subtitle, 
  badge, 
  leftIcon, 
  rightContent, 
  onClick,
  actions 
}: MobileCardListItemProps) {
  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg p-4 ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''} transition-all`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {leftIcon && (
          <div className="flex-shrink-0 mt-1">
            {leftIcon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-medium text-gray-900 break-words flex-1">{title}</h3>
            {badge && (
              <div className="flex-shrink-0">
                {badge}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-600 mb-2 break-words">{subtitle}</p>
          )}
          {rightContent && (
            <div className="mt-2">
              {rightContent}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 lg:py-16 px-4">
      {icon && (
        <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg lg:text-xl font-medium text-gray-900 mb-2 text-center">{title}</h3>
      {description && (
        <p className="text-sm lg:text-base text-gray-600 mb-6 text-center max-w-md">{description}</p>
      )}
      {action && action}
    </div>
  );
}
