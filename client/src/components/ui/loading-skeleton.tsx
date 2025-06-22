import { Skeleton } from "@/components/ui/skeleton";

interface DocumentRowSkeletonProps {
  className?: string;
}

export function DocumentRowSkeleton({ className }: DocumentRowSkeletonProps) {
  return (
    <tr className={className}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <Skeleton className="w-8 h-8 rounded-lg mr-3" />
          <div>
            <Skeleton className="h-4 w-40 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Skeleton className="h-6 w-20 rounded-full" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Skeleton className="h-6 w-28 rounded-full" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      </td>
    </tr>
  );
}

interface DocumentTableSkeletonProps {
  rows?: number;
  showHeader?: boolean;
}

export function DocumentTableSkeleton({ rows = 8, showHeader = true }: DocumentTableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          {showHeader && (
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
          )}
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, index) => (
              <DocumentRowSkeleton key={index} className="hover:bg-gray-50" />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentDocumentsTableSkeleton() {
  return <DocumentTableSkeleton rows={3} />;
}

export function DocumentsPageTableSkeleton() {
  return <DocumentTableSkeleton rows={8} />;
}