"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { renderFormFields } from "./form-content";
import { useToast } from "@/context/ToastContext";

interface LedDisplay {
  _id: string;
  sku: string;
  category: string;
  territory?: string;
  application?: string;
  ipRating?: string;
  pixelPitch?: string;
  totalResolution?: string;
  sqft?: number;
  price: number;
  
  cabinetMaterialVariants?: {
    material: string;
    price: number;
  }[];
  
  moduleSpecs?: {
    pixelPitch?: string;
    pixelConfiguration?: string;
    moduleResolution?: string;
    moduleSize?: string;
    moduleWeight?: number;
  };
  
  cabinetSpecs?: {
    cabinetSize?: string;
    cabinetResolution?: string;
    moduleQuantity?: number;
    pixelDensity?: string;
    cabinetWeight?: number;
    cabinetArea?: number;
    material?: string;
    maintenance?: string;
  };
  
  screenParams?: {
    brightnessControl?: string;
    whiteBalanceBrightness?: string;
    colorTemperature?: string;
    bestViewingDistance?: string;
    brightnessUniformity?: string;
    colorUniformity?: string;
    protectiveGrade?: string;
    viewAngle?: string;
    defectsRate?: string;
    frameFrequency?: string;
    refreshRate?: string;
    inputVoltage?: string;
    maxPowerConsumption?: string;
    avgPowerConsumption?: string;
    lifeSpan?: string;
    temperatureOperating?: string;
    humidityOperating?: string;
  };
  
  images?: string[];
  productImages?: string[];
}

export default function LedDisplaysAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [displays, setDisplays] = useState<LedDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDisplay, setEditingDisplay] = useState<LedDisplay | null>(null);
  const [formData, setFormData] = useState<Partial<LedDisplay>>({});
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [territoryFilter, setTerritoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/");
      return;
    }
    fetchDisplays();
  }, [session, status, router]);

  const fetchDisplays = async () => {
    try {
      const res = await fetch("/api/led-displays");
      if (!res.ok) throw new Error("Failed to fetch displays");
      const data = await res.json();
      setDisplays(data);
    } catch (error) {
      console.error("Error fetching displays:", error);
      setError("Failed to load displays");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const url = "/api/led-displays";
      const method = editingDisplay ? "PUT" : "POST";
      
      console.log('Form data before cleaning:', formData);
      console.log('Cabinet Material Variants before cleaning:', formData.cabinetMaterialVariants);
      
      // Filter out empty/invalid cabinet material variants
      const cleanedFormData = { ...formData };
      if (cleanedFormData.cabinetMaterialVariants) {
        cleanedFormData.cabinetMaterialVariants = cleanedFormData.cabinetMaterialVariants.filter(
          (variant: any) => {
            const hasValidMaterial = variant.material && variant.material.trim() !== "";
            const hasValidPrice = variant.price && parseFloat(variant.price) > 0;
            console.log(`Variant check - Material: "${variant.material}", Price: ${variant.price}, Valid: ${hasValidMaterial && hasValidPrice}`);
            return hasValidMaterial && hasValidPrice;
          }
        );
        console.log('Cabinet Material Variants after filtering:', cleanedFormData.cabinetMaterialVariants);
        // Remove the array if it's empty
        if (cleanedFormData.cabinetMaterialVariants.length === 0) {
          console.log('No valid variants, removing array');
          delete cleanedFormData.cabinetMaterialVariants;
        }
      }
      
      const body = editingDisplay ? { ...cleanedFormData, _id: editingDisplay._id } : cleanedFormData;
      console.log('Sending to API:', body);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || "Failed to save display");
      }

      showToast(editingDisplay ? "Display updated successfully" : "Display created successfully", "success");
      await fetchDisplays();
      setShowModal(false);
      setEditingDisplay(null);
      setFormData({});
    } catch (error: any) {
      console.error("Error saving display:", error);
      setError(error.message || "Failed to save display");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this display?")) return;

    try {
      const res = await fetch(`/api/led-displays?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete display");
      await fetchDisplays();
    } catch (error) {
      console.error("Error deleting display:", error);
      setError("Failed to delete display");
    }
  };

  const openEditModal = (display: LedDisplay) => {
    console.log('Opening edit modal for display:', display._id);
    console.log('Display data:', display);
    console.log('Cabinet Material Variants:', display.cabinetMaterialVariants);
    setEditingDisplay(display);
    setFormData(display);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingDisplay(null);
    setFormData({});
    setShowModal(true);
  };

  // Filter and pagination
  const filteredDisplays = displays.filter(display => {
    if (territoryFilter !== "All" && display.territory !== territoryFilter && display.territory !== "Both") return false;
    
    if (!searchTerm) return true;
    
    return display.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    display.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    display.application?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredDisplays.length / itemsPerPage);
  const paginatedDisplays = filteredDisplays.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Build Screen Parameters suggestion lists from existing displays
  const screenParamSuggestions = displays.reduce((acc, d) => {
    const sp = d.screenParams || {};
    const add = (key: keyof NonNullable<typeof d.screenParams>) => {
      const val = sp[key];
      if (val && typeof val === 'string') {
        const arr = acc[key] || (acc[key] = []);
        if (!arr.includes(val)) arr.push(val);
      }
    };

    add('brightnessControl');
    add('whiteBalanceBrightness');
    add('colorTemperature');
    add('bestViewingDistance');
    add('brightnessUniformity');
    add('colorUniformity');
    add('protectiveGrade');
    add('viewAngle');
    add('defectsRate');
    add('frameFrequency');
    add('refreshRate');
    add('inputVoltage');
    add('maxPowerConsumption');
    add('avgPowerConsumption');
    add('lifeSpan');
    add('temperatureOperating');
    add('humidityOperating');

    return acc;
  }, {} as { [key: string]: string[] });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">LED Displays Management</h1>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Display
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search displays..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            
            <select
              value={territoryFilter}
              onChange={(e) => {
                setTerritoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-gray-700 font-medium"
            >
              <option value="All">All Territories</option>
              <option value="Middle East">Middle East</option>
              <option value="India">India</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pixel Pitch</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Application</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price (INR)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Materials</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedDisplays.map((display) => (
                <tr key={display._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{display.sku}</td>
                  <td className="px-4 py-3 text-gray-700">{display.category}</td>
                  <td className="px-4 py-3 text-gray-700">{display.pixelPitch || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{display.application || '-'}</td>
                  <td className="px-4 py-3 text-gray-900">₹{(Math.round(display.price * 100) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
                    {display.cabinetMaterialVariants && display.cabinetMaterialVariants.length > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {display.cabinetMaterialVariants.length} variant{display.cabinetMaterialVariants.length > 1 ? 's' : ''}
                      </span>
                    ) : display.cabinetSpecs?.material ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {display.cabinetSpecs.material}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(display)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(display._id)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingDisplay ? "Edit Display" : "Add Display"}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-700">SKU *</label>
                      <input
                        type="text"
                        required
                        value={formData.sku || ""}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                      />
                    </div>
                  </div>

                  {renderFormFields(formData, setFormData, false, screenParamSuggestions)}

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
                      <select
                        value={formData.territory || 'Middle East'}
                        onChange={(e) => setFormData({
                          ...formData, territory: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="Middle East">Middle East</option>
                        <option value="India">India</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      {editingDisplay ? "Update" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
