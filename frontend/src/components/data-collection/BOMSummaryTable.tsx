import React from "react";
import type { BOMMaterial } from "./BOMMaterialModal";

interface BOMSummaryTableProps {
  bomMaterials: BOMMaterial[];
}

export const BOMSummaryTable = ({ bomMaterials }: BOMSummaryTableProps) => {
  // Group materials by category
  const groupedByCategory = bomMaterials.reduce((acc, material) => {
    const category = material.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(material);
    return acc;
  }, {} as Record<string, BOMMaterial[]>);

  // Calculate totals for each category
  const categorySummary = Object.entries(groupedByCategory).map(([category, materials]) => {
    const totalVolumeInstalled = materials.reduce((sum, m) => sum + (m.volume || 0), 0);
    const totalWeightInstalled = materials.reduce((sum, m) => sum + (m.weightInstalled || 0), 0);
    const totalQtyInstalled = materials.reduce((sum, m) => sum + (m.qtyInstalled || 0), 0);
    const totalQtyDelivery = materials.reduce((sum, m) => sum + (m.qtyDelivery || 0), 0);
    
    return {
      category,
      materials,
      totalVolumeInstalled,
      totalWeightInstalled,
      totalQtyInstalled,
      totalQtyDelivery,
    };
  });

  // Grand totals
  const grandTotalVolumeInstalled = categorySummary.reduce((sum, c) => sum + c.totalVolumeInstalled, 0);
  const grandTotalWeightInstalled = categorySummary.reduce((sum, c) => sum + c.totalWeightInstalled, 0);
  const grandTotalQtyDelivery = categorySummary.reduce((sum, c) => sum + c.totalQtyDelivery, 0);

  if (bomMaterials.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Belum ada BOM Material. Klik "Tambah BOM Material" untuk mulai.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary BOM Header */}
      <div className="bg-gradient-to-r from-gray-900 via-red-600 to-gray-900 text-white p-4 rounded-t-lg">
        <h3 className="font-bold text-lg">📋 BILL OF MATERIAL - Summary BOM</h3>
        <p className="text-sm text-gray-200">Grouped by Material Category</p>
      </div>

      {/* Category-wise Summary */}
      <div className="overflow-x-auto">
        <table className="w-full border-2 border-gray-900">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-4 py-3 text-left border border-gray-700">NO</th>
              <th className="px-4 py-3 text-left border border-gray-700">PRODUCT</th>
              <th className="px-4 py-3 text-center border border-gray-700">Density<br/>(Kg/m³)</th>
              <th className="px-4 py-3 text-center border border-gray-700">Volume<br/>(m³)</th>
              <th className="px-4 py-3 text-center border border-gray-700">Quantity<br/>Installed</th>
              <th className="px-4 py-3 text-center border border-gray-700">Quantity<br/>Delivered</th>
              <th className="px-4 py-3 text-left border border-gray-700">Unit</th>
              <th className="px-4 py-3 text-center border border-gray-700">Total Weight<br/>(Kg)</th>
            </tr>
          </thead>
          <tbody>
            {categorySummary.map((categoryData, catIdx) => (
              <React.Fragment key={catIdx}>
                {/* Category Header */}
                <tr className="bg-red-600 text-white font-bold">
                  <td colSpan={8} className="px-4 py-2 border border-gray-300">
                    {categoryData.category}
                  </td>
                </tr>
                
                {/* Materials in this category */}
                {categoryData.materials.map((material, matIdx) => (
                  <tr key={material.id} className={matIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2 border border-gray-300 text-center">{matIdx + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 font-semibold">
                      {material.productName}
                      {material.notes && (
                        <div className="text-xs text-gray-500 italic mt-1">{material.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center font-mono">
                      {material.density.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center font-mono">
                      {material.volume.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center font-mono font-bold text-blue-700">
                      {material.qtyInstalled.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center font-mono font-bold text-green-700">
                      {material.qtyDelivery.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center">
                      {material.unitDelivery}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center font-mono font-bold">
                      {material.weightInstalled.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}

                {/* Category Subtotal */}
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={3} className="px-4 py-2 border border-gray-300 text-right">
                    Subtotal {categoryData.category}:
                  </td>
                  <td className="px-4 py-2 border border-gray-300 text-center font-mono">
                    {categoryData.totalVolumeInstalled.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 border border-gray-300 text-center font-mono text-blue-700">
                    {categoryData.totalQtyInstalled.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 border border-gray-300 text-center font-mono text-green-700">
                    {categoryData.totalQtyDelivery.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 border border-gray-300"></td>
                  <td className="px-4 py-2 border border-gray-300 text-center font-mono">
                    {categoryData.totalWeightInstalled.toLocaleString('id-ID')}
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {/* Grand Total */}
            <tr className="bg-gradient-to-r from-red-700 to-gray-900 text-white font-bold text-lg">
              <td colSpan={3} className="px-4 py-3 border border-gray-300 text-right">
                GRAND TOTAL:
              </td>
              <td className="px-4 py-3 border border-gray-300 text-center font-mono">
                {grandTotalVolumeInstalled.toFixed(2)}
              </td>
              <td className="px-4 py-3 border border-gray-300 text-center font-mono">
                -
              </td>
              <td className="px-4 py-3 border border-gray-300 text-center font-mono">
                {grandTotalQtyDelivery.toLocaleString('id-ID')}
              </td>
              <td className="px-4 py-3 border border-gray-300"></td>
              <td className="px-4 py-3 border border-gray-300 text-center font-mono">
                {grandTotalWeightInstalled.toLocaleString('id-ID')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-600 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Categories</div>
          <div className="text-2xl font-bold text-blue-700">{categorySummary.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-600 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Products</div>
          <div className="text-2xl font-bold text-green-700">{bomMaterials.length}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-600 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Volume (m³)</div>
          <div className="text-2xl font-bold text-purple-700 font-mono">
            {grandTotalVolumeInstalled.toFixed(2)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white border-2 border-red-600 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Weight (Kg)</div>
          <div className="text-2xl font-bold text-red-700 font-mono">
            {grandTotalWeightInstalled.toLocaleString('id-ID')}
          </div>
        </div>
      </div>
    </div>
  );
};
