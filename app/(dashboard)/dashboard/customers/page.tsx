'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Customer {
  id: string;
  displayName: string;
  primaryPhone: string;
  email: string | null;
  location: string | null;
  tags: string[];
  optedIn: boolean;
  activePolicy?: {
    id: string;
    policyNumber: string;
    status: string;
  } | null;
}

export default function CustomersIndexPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch list of customers
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/customers');
      if (!res.ok) throw new Error('Failed to load customers');
      return res.json();
    },
  });

  // Filter customers by display name or phone
  const filteredCustomers = customers.filter(
    (c) =>
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.primaryPhone.includes(searchQuery)
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-y-auto">
      {/* Header bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-8 shrink-0 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Customers & Contact Directory
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            Manage synchronized contact profiles, consent status, policy affiliations, and lifetime interactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              id="customer-search"
              name="customerSearch"
              aria-label="Search customers"
              type="text"
              placeholder="Search by name, phone, or policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50/60 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B91] focus:bg-white w-72 font-medium transition"
            />
          </div>
        </div>
      </header>

      {/* Main card list container */}
      <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              All Contacts ({filteredCustomers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                Loading contacts...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No customers found matching "{searchQuery}"
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200/80">
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider">Phone / Identifier</th>
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider">Active Policy</th>
                    <th className="px-6 py-3.5 font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((customer) => {
                    const initials = customer.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1B4B91] border border-blue-200/60 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {initials}
                            </div>
                            <div>
                              <Link
                                href={`/dashboard/customers/${customer.id}`}
                                className="font-bold text-xs text-[#1B4B91] hover:underline"
                              >
                                {customer.displayName}
                              </Link>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {customer.email || 'No email registered'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {customer.primaryPhone}
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                            <span className={`w-1.5 h-1.5 rounded-full ${customer.optedIn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {customer.optedIn ? 'Opted In' : 'No Consent'}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600">
                          {customer.location || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {customer.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold border border-slate-200/60"
                              >
                                {tag}
                              </span>
                            ))}
                            {customer.tags.length === 0 && <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {customer.activePolicy ? (
                            <div>
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {customer.activePolicy.policyNumber}
                              </span>
                              <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                Status: {customer.activePolicy.status}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">No Active Policy</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/customers/${customer.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-[10px] font-bold shadow-sm transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                            View Profile
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
