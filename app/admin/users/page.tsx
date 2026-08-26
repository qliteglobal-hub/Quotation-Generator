"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

interface User {
  _id: string;
  name: string;
  email: string;
  companyName: string;
  country: string;
  city: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && (session?.user?.role !== "admin" || session?.user?.email !== "admin@qlite.com"))) {
      router.push("/products");
    } else if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      if (res.ok) {
        setUsers(users.map(u => u._id === userId ? { ...u, status: newStatus } : u));
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      setUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, role: newRole } : u
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt("Enter the new temporary password for this user:");
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });
      if (res.ok) {
        alert("Password reset successfully!");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to reset password");
      }
    } catch (error) {
      console.error("Failed to reset password", error);
      alert("An error occurred while resetting the password");
    }
  };

  const filteredUsers = users.filter(u => filter === "all" || u.status === filter || (!u.status && filter === "pending"));

  if (loading || status === "loading") return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Approvals</h1>
            <p className="text-gray-600 mt-1">Manage user access and registrations</p>
          </div>
          <Link href="/admin" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            Back to Products
          </Link>
        </div>

        <div className="mb-6 flex gap-2">
          {["all", "pending", "approved", "rejected"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize font-medium ${filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City/Territory</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                    <p className="text-xs text-gray-400 font-normal">
                      Click to change
                    </p>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.companyName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.country || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.city || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'manager' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'admin' ? '🔑 Admin' : user.role === 'manager' ? '👤 Manager' : '👤 User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {user.status === "approved" && <span className="inline-flex items-center gap-1 text-green-700 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-full">✅ Active</span>}
                      {(!user.status || user.status === "pending") && <span className="inline-flex items-center gap-1 text-yellow-700 text-xs font-bold bg-yellow-50 px-3 py-1.5 rounded-full">⏳ Pending Approval</span>}
                      {user.status === "rejected" && <span className="inline-flex items-center gap-1 text-red-700 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-full">🚫 Access Blocked</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {user.email === 'admin@qlite.com' ? (
                        <span className="text-gray-400 text-xs italic mr-2">Protected Account</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {(!user.status || user.status === "pending") && (
                            <>
                              <button onClick={() => handleUpdateStatus(user._id, "approved")} className="text-green-600 hover:text-green-900 font-semibold px-2 py-1">Approve</button>
                              <button onClick={() => handleUpdateStatus(user._id, "rejected")} className="text-red-600 hover:text-red-900 font-semibold px-2 py-1">Reject</button>
                            </>
                          )}
                          
                          {user.status === "approved" && (
                            <>
                              <button onClick={() => handleUpdateStatus(user._id, "rejected")} className="text-red-600 hover:text-red-900 font-semibold px-2 py-1">Reject</button>
                              {user.role === 'admin' ? (
                                <button
                                  onClick={() => {
                                    if (confirm('Remove admin access from this user?')) {
                                      handleRoleChange(user._id, 'user');
                                    }
                                  }}
                                  className="text-orange-500 hover:text-orange-700 text-xs cursor-pointer px-2 py-1 rounded hover:bg-orange-50 transition-all"
                                >
                                  Remove Admin
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (confirm('Give admin access to this user?')) {
                                      handleRoleChange(user._id, 'admin');
                                    }
                                  }}
                                  className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer px-2 py-1 rounded hover:bg-blue-50 transition-all"
                                >
                                  Make Admin
                                </button>
                              )}
                            </>
                          )}

                          {user.status === "rejected" && (
                            <button onClick={() => handleUpdateStatus(user._id, "approved")} className="text-green-600 hover:text-green-900 font-semibold px-2 py-1">Approve</button>
                          )}
                          
                          <button
                            onClick={() => handleResetPassword(user._id)}
                            className="text-gray-500 hover:text-gray-900 text-xs cursor-pointer px-2 py-1 rounded hover:bg-gray-100 transition-all font-semibold"
                            title="Reset Password"
                          >
                            Reset Password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
