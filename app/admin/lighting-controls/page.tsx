"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface LightingControl {
  _id: string;
  sku: string;
  category: string;
  territory?: string;
  productImage?: string;
  productCode: string;
  productName: string;
  description?: string;
  priceVariants?: {
    channels?: number;
    size?: string;
    price: number;
  }[];
  controlType?: string;
  protocol?: string;
  channels?: number;
  loadCapacity?: string;
  inputVoltage?: string;
  outputVoltage?: string;
  dimmingRange?: string;
  mounting?: string;
  connectivity?: string;
  compatibility?: string;
  ipRating?: string;
  application?: string;
  price: number;
  images?: string[];
  productImages?: string[];
}

export default function LightingControlsAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [controls, setControls] = useState<LightingControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingControl, setEditingControl] = useState<LightingControl | null>(null);
  const [formData, setFormData] = useState<Partial<LightingControl>>({});
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
    fetchControls();
  }, [session, status, router]);

  const fetchControls = async () => {
    try {
      const res = await fetch("/api/lighting-controls");
      if (!res.ok) throw new Error("Failed to fetch controls");
      const data = await res.json();
      setControls(data);
    } catch (error) {
      console.error("Error fetching controls:", error);
      setError("Failed to load controls");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation: Either base price or price variants must be provided
    const hasBasePrice = formData.price && formData.price > 0;
    const hasVariants = formData.priceVariants && formData.priceVariants.length > 0 && 
                       formData.priceVariants.some(v => v.price > 0);
    
    if (!hasBasePrice && !hasVariants) {
      setError("Please provide either a base price or at least one price variant");
      return;
    }

    try {
      const url = "/api/lighting-controls";
      const method = editingControl ? "PUT" : "POST";
      const body = editingControl ? { ...formData, _id: editingControl._id } : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.details || errorData.error || "Failed to save control");
      }

      showToast(editingControl ? "Control updated successfully" : "Control created successfully", "success");
      await fetchControls();
      setShowModal(false);
      setEditingControl(null);
      setFormData({});
    } catch (error) {
      console.error("Error saving control:", error);
      setError(error instanceof Error ? error.message : "Failed to save control");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this control?")) return;

    try {
      const res = await fetch(`/api/lighting-controls?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete control");
      await fetchControls();
    } catch (error) {
      console.error("Error deleting control:", error);
      setError("Failed to delete control");
    }
  };

  const openEditModal = (control: LightingControl) => {
    setEditingControl(control);
    setFormData(control);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingControl(null);
    setFormData({});
    setShowModal(true);
  };

  // Filter and pagination
  const filteredControls = controls.filter(control => {
    if (territoryFilter !== "All" && control.territory !== territoryFilter && control.territory !== "Both") return false;
    
    if (!searchTerm) return true;
    
    return control.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredControls.length / itemsPerPage);
  const paginatedControls = filteredControls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
          <h1 className="text-3xl font-bold text-gray-900">Lighting Controls Management</h1>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Control
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
                placeholder="Search controls..."
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ok</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ok</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price (INR)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedControls.map((control) => (
                <tr key={control._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{control.sku}</td>
                  <td className="px-4 py-3 text-gray-700">{control.category}</td>
                  <td className="px-4 py-3 text-gray-700">{control.controlType || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{control.protocol || '-'}</td>
                  <td className="px-4 py-3 text-gray-900">₹{control.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(control)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(control._id)}
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
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingControl ? "Edit Control" : "Add Control"}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-700">Category *</label>
                      <input
                        type="text"
                        required
                        value={formData.category || ""}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.productName || ""}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Product Image</label>
                    <input
                      type="text"
                      placeholder="Enter image URL"
                      value={formData.productImage || ""}
                      onChange={(e) => setFormData({ ...formData, productImage: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Description</label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Input Voltage</label>
                    <input
                      type="text"
                      placeholder="e.g., 110-240V AC"
                      value={formData.inputVoltage || ""}
                      onChange={(e) => setFormData({ ...formData, inputVoltage: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      Base Price (INR) {formData.priceVariants && formData.priceVariants.length > 0 ? "(Optional)" : "*"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required={!formData.priceVariants || formData.priceVariants.length === 0}
                      value={formData.price || ""}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
                    />
                    {formData.priceVariants && formData.priceVariants.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Base price is optional when variants are defined. Variants will be used for pricing.</p>
                    )}
                  </div>

                  {/* Price Variants Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-gray-700">
                        Price Variants {!formData.price || formData.price === 0 ? "*" : "(Optional)"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const currentVariants = formData.priceVariants || [];
                          setFormData({ 
                            ...formData, 
                            priceVariants: [...currentVariants, { channels: undefined, size: '', price: 0 }]
                          });
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                      >
                        Add Variant
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Add different prices based on channels and/or size specifications
                    </div>
                    
                    {formData.priceVariants && formData.priceVariants.length > 0 && (
                      <div className="space-y-2">
                        {formData.priceVariants.map((variant, index) => (
                          <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Size (e.g., Small, Medium, Large)"
                                value={variant.size || ""}
                                onChange={(e) => {
                                  const newVariants = [...(formData.priceVariants || [])];
                                  newVariants[index] = { ...variant, size: e.target.value };
                                  setFormData({ ...formData, priceVariants: newVariants });
                                }}
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Price (INR)"
                                value={variant.price || ""}
                                onChange={(e) => {
                                  const newVariants = [...(formData.priceVariants || [])];
                                  newVariants[index] = { ...variant, price: parseFloat(e.target.value) || 0 };
                                  setFormData({ ...formData, priceVariants: newVariants });
                                }}
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newVariants = [...(formData.priceVariants || [])];
                                newVariants.splice(index, 1);
                                setFormData({ ...formData, priceVariants: newVariants });
                              }}
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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

                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200 mt-4">
                    <p className="font-semibold mb-1 text-gray-900">Note:</p>
                    <p>Additional fields and filters will be added later. This is a basic setup for now.</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      {editingControl ? "Update" : "Create"}
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
