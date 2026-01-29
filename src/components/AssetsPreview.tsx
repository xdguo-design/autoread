type AssetItem = {
  name: string;
  url: string;
};

export default function AssetsPreview({
  title,
  items,
  usedNames,
}: {
  title: string;
  items: AssetItem[];
  usedNames: string[];
}) {
  if (!items.length) return null;

  const usedSet = new Set(usedNames);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-sm text-gray-500">{items.length}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.url} className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <img src={item.url} alt={item.name} className="w-full h-32 object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-white truncate">{item.name}</span>
                {usedSet.has(item.name) ? (
                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                    Used
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
