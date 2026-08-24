"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AdminQuotation {
  _id: string;
  quotationNumber: string;
  userName: string;
  userRole: string;
  createdAt?: string;
}

export default function AdminQuotationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quotations, setQuotations] = useState<AdminQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleRowClick = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/quotations/${id}`);
      const data = await res.json();
      setSelectedQuotation(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/admin/quotations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setQuotations(prev => prev.filter(q => q._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetch('/api/admin/quotations/cleanup', { 
        method: 'DELETE' 
      }).then(res => res.json())
        .then(data => {
          if (data.deleted > 0) {
            console.log(`Auto-cleaned ${data.deleted} old quotations`);
          }
        }).catch(console.error);
    }
  }, [session]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user?.role !== "admin") {
      router.push("/");
      return;
    }

    const fetchQuotations = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/quotations");
        if (!res.ok) {
          throw new Error("Failed to fetch quotations");
        }
        const data = await res.json();
        setQuotations(data);
      } catch (err: any) {
        console.error("Error loading quotations:", err);
        setError(err.message || "Failed to load quotations");
      } finally {
        setLoading(false);
      }
    };

    fetchQuotations();
  }, [status, session, router]);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-gray-600 text-sm">Loading quotations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Quotations</h1>

      {quotations.length === 0 ? (
        <p className="text-sm text-gray-500">No quotations have been generated yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Quotation No</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">User Name</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">User Role</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Created At</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotations.map((q) => (
                <tr 
                  key={q._id} 
                  onClick={() => handleRowClick(q._id)}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-xs text-blue-700 break-all">
                    {q.quotationNumber}
                  </td>
                  <td className="px-4 py-2 text-gray-900">{q.userName}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {q.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {q.createdAt ? new Date(q.createdAt).toLocaleString('en-GB') : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this quotation?')) {
                          handleDelete(q._id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs cursor-pointer px-2 py-1 rounded hover:bg-red-50 transition-all"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 
          z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl 
            w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Quotation Details
              </h2>
              <button
                onClick={() => setSelectedQuotation(null)}
                className="text-gray-400 hover:text-gray-600 
                  text-2xl cursor-pointer"
              >×</button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6 
              p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Project Code</p>
                <p className="font-semibold text-gray-900">
                  {selectedQuotation.quotationNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(selectedQuotation.createdAt).toLocaleString('en-GB')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">User</p>
                <p className="font-semibold text-gray-900">
                  {selectedQuotation.userName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Role</p>
                <p className="font-semibold text-gray-900">
                  {selectedQuotation.userRole}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Company</p>
                <p className="font-semibold text-gray-900">
                  {selectedQuotation.userCompanyName || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="font-bold text-green-600 text-lg">
                  ₹{selectedQuotation.totalPrice?.toLocaleString('en-IN', {
                    minimumFractionDigits: 2
                  }) || '0.00'}
                </p>
              </div>
            </div>

            {/* Products Table */}
            <h3 className="font-semibold text-gray-700 mb-2">Products</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">SKU</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Category</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedQuotation.products?.map((p: any, idx: number) => {
                    const unitPrice = p.unitPrice || 0;
                    const qty = p.quantity || 1;
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-blue-700">
                          {p.sku || p.productId?.sku || 'N/A'}
                          {p.isDriver && (
                            <span className="text-xs text-purple-600 ml-1">
                              (Driver)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {p.category || p.productId?.category || '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {qty}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          ₹{(unitPrice * qty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
