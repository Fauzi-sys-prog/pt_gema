import { ReactNode } from 'react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  primary?: boolean; // Show in card header
  secondary?: boolean; // Show as subtitle
}

interface MobileTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
}

export function MobileTable<T>({ 
  data, 
  columns, 
  onRowClick,
  emptyMessage = 'No data available',
  keyExtractor 
}: MobileTableProps<T>) {
  const primaryColumn = columns.find(col => col.primary);
  const secondaryColumn = columns.find(col => col.secondary);
  const detailColumns = columns.filter(col => !col.primary && !col.secondary);

  const getValue = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item);
    }
    return item[column.key as keyof T] as ReactNode;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div
          key={keyExtractor(item)}
          onClick={() => onRowClick?.(item)}
          className={`bg-white border border-gray-200 rounded-lg p-4 ${
            onRowClick ? 'active:bg-gray-50 cursor-pointer' : ''
          } transition-colors touch-manipulation`}
        >
          {/* Header */}
          {primaryColumn && (
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-gray-900 flex-1">
                {getValue(item, primaryColumn)}
              </h3>
            </div>
          )}

          {/* Subtitle */}
          {secondaryColumn && (
            <p className="text-sm text-gray-600 mb-3">
              {getValue(item, secondaryColumn)}
            </p>
          )}

          {/* Details */}
          {detailColumns.length > 0 && (
            <div className="space-y-2">
              {detailColumns.map((column, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{column.label}</span>
                  <span className="font-medium text-gray-900 text-right">
                    {getValue(item, column)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
