// src/pages/admin/Statistics.tsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import toast from "react-hot-toast";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

interface EventData {
  id: string;
  title?: string;
  start_date?: string;
  category_id?: string | null;
}

interface RegistrationData {
  id: string;
  status?: string;
}

const Statistics: React.FC = () => {
  const { token } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventData[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [eventRes, regRes, mgrRes, catRes] = await Promise.all([
        apiFetch("/events", {}, token),
        apiFetch("/registrations", {}, token),
        apiFetch("/event-managers", {}, token),
        apiFetch("/categories", {}, token),
      ]);

      setEvents(eventRes.data || []);
      setRegistrations(regRes.data || []);
      setManagers(mgrRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* Derived stats */
  const totalEvents = events.length;
  const totalRegistrants = registrations.length;
  const pendingRegs = registrations.filter((r) => (r.status || "").toLowerCase() === "pending").length;
  const approvedRegs = registrations.filter((r) => (r.status || "").toLowerCase() === "approved").length;
  const totalManagers = managers.length;

  /* Events per month */
  const monthlyCounts = new Array(12).fill(0);
  events.forEach((evt) => {
    if (!evt.start_date) return;
    const d = new Date(evt.start_date);
    if (!isNaN(d.getTime())) {
      monthlyCounts[d.getMonth()] = (monthlyCounts[d.getMonth()] || 0) + 1;
    }
  });

  const eventsOverTimeData = {
    labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    datasets: [
      {
        label: "Events Created",
        data: monthlyCounts,
        backgroundColor: "#3B82F6",
        borderRadius: 6,
      },
    ],
  };

  /* Category distribution */
  const categoryCounts: Record<string, number> = {};
  events.forEach((evt) => {
    const id = evt.category_id || "uncategorized";
    categoryCounts[id] = (categoryCounts[id] || 0) + 1;
  });

  const categoryIds = Object.keys(categoryCounts);
  const categoryLabels = categoryIds.map((id) => {
    const found = categories.find((c: any) => c.id === id);
    return found ? found.name : id === "uncategorized" ? "Uncategorized" : id;
  });
  const categoryValues = categoryIds.map((id) => categoryCounts[id]);

  const categoryDistributionData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryValues,
        backgroundColor: ["#60A5FA","#F472B6","#34D399","#FBBF24","#A78BFA","#F87171","#22D3EE"],
      },
    ],
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">📊 Statistics Overview</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading statistics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <SummaryCard label="Total Events" value={totalEvents} color="bg-blue-600" />
            <SummaryCard label="Registrants" value={totalRegistrants} color="bg-indigo-600" />
            <SummaryCard label="Pending" value={pendingRegs} color="bg-yellow-500" />
            <SummaryCard label="Approved" value={approvedRegs} color="bg-green-600" />
            <SummaryCard label="Managers" value={totalManagers} color="bg-purple-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">Events Created Per Month</h2>
              <Bar
                data={eventsOverTimeData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false }, title: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                }}
              />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">Events by Category</h2>
              {categoryValues.length === 0 ? (
                <div className="text-gray-500">No category data</div>
              ) : (
                <Pie
                  data={categoryDistributionData}
                  options={{ plugins: { legend: { position: "bottom" as const } } }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className={`p-4 rounded-lg shadow-md text-white flex flex-col justify-center items-center ${color}`}>
    <span className="text-3xl font-bold">{value}</span>
    <span className="text-sm opacity-90">{label}</span>
  </div>
);

export default Statistics;
