import { memo } from 'react';

const GroceryListSkeleton = memo(() => {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-3 rounded animate-pulse">
          <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
          <div className="flex-1">
            <div 
              className="h-4 bg-gray-300 rounded" 
              style={{ width: `${Math.random() * 40 + 60}%` }}
            ></div>
          </div>
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
        </div>
      ))}
    </div>
  );
});

GroceryListSkeleton.displayName = 'GroceryListSkeleton';

export default GroceryListSkeleton;