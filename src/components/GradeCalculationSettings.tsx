import React, { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { firestoreDb } from "../utils/firebaseClient";
import {
  DEFAULT_GRADE_WEIGHTS,
  GRADE_CATEGORY_LABELS,
  GradeCategoryKey,
  GradeWeights,
  validateGradeWeights,
} from "../utils/gradeCalculation";
import { Save, RotateCcw, AlertTriangle, CheckCircle2, Sliders } from "lucide-react";

export function GradeCalculationSettings() {
  const [weights, setWeights] = useState<GradeWeights>(DEFAULT_GRADE_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!firestoreDb) {
      setLoading(false);
      return;
    }

    const docRef = doc(firestoreDb, "system_settings", "grade_calculation");
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.weights) {
            // Merge loaded weights with defaults to ensure all keys are present
            const merged = { ...DEFAULT_GRADE_WEIGHTS, ...data.weights };
            setWeights(merged);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch grade weights:", err);
        setErrorMsg("Failed to load grade weights from database.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleWeightChange = (key: GradeCategoryKey, value: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const numericValue = value === "" ? 0 : Number(value);
    setWeights((prev) => ({
      ...prev,
      [key]: numericValue,
    }));
  };

  const validation = useMemo(() => {
    return validateGradeWeights(weights);
  }, [weights]);

  const handleSave = async () => {
    if (!validation.valid) {
      setErrorMsg(validation.errors[0] || "Invalid weights configuration.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!firestoreDb) {
        throw new Error("Firestore is database is not loaded.");
      }

      const docRef = doc(firestoreDb, "system_settings", "grade_calculation");
      await setDoc(docRef, {
        weights,
        updatedAt: new Date().toISOString(),
      });

      setSuccessMsg("Grade weights saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error saving weights:", err);
      setErrorMsg(err?.message || "Failed to save weights.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset weights to the default configuration?")) {
      setWeights(DEFAULT_GRADE_WEIGHTS);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center space-y-4 rounded-2xl border border-slate-200 bg-white p-8 dark:bg-slate-900 dark:border-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-950" />
        <p className="text-sm font-semibold text-slate-500">Loading grade settings...</p>
      </div>
    );
  }

  const isTotalCorrect = Math.abs(validation.total - 100) < 0.001;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2.5 text-white dark:bg-slate-800">
            <Sliders size={22} />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black uppercase text-slate-900 dark:text-white leading-tight">
              Grade Calculation Settings
            </h2>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Configure the percentage weight for each score category. Weights must total exactly 100%.
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50 transition cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <RotateCcw size={15} />
          Reset Defaults
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="text-xs font-bold">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0" />
          <p className="text-xs font-bold">{successMsg}</p>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Form Column */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="space-y-4">
            {(Object.keys(DEFAULT_GRADE_WEIGHTS) as GradeCategoryKey[]).map((key) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50 transition dark:border-slate-800 dark:hover:bg-slate-800/40"
              >
                <div className="text-left">
                  <span className="text-sm font-black text-slate-800 dark:text-white">
                    {GRADE_CATEGORY_LABELS[key]}
                  </span>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Category weight in performance calculation
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights[key] === 0 ? "" : weights[key]}
                    placeholder="0"
                    onChange={(e) => handleWeightChange(key, e.target.value)}
                    className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  />
                  <span className="text-sm font-black text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info/Status Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm flex flex-col justify-between dark:bg-slate-900/40 dark:border-slate-800">
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Configuration Status
            </h3>

            <div className="rounded-xl border border-slate-150 bg-white p-4 text-center dark:bg-slate-900 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                Total Weight
              </span>
              <span
                className={`mt-1.5 inline-block text-4xl font-black ${
                  isTotalCorrect ? "text-emerald-600" : "text-amber-500"
                }`}
              >
                {validation.total.toFixed(1)}%
              </span>
              <p className="mt-2 text-[11px] font-bold text-slate-400 leading-tight">
                Must be exactly <strong className="text-slate-600 dark:text-slate-300">100%</strong>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                Rules & Validation
              </h4>
              <ul className="text-xs font-semibold text-slate-500 space-y-1.5 list-disc pl-4 text-left">
                <li>Individual weights cannot exceed 100%</li>
                <li>Individual weights cannot be negative</li>
                <li>Missing/unsubmitted scores default to 0</li>
                <li>A category can be weighted 0% to exclude it</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200/55 pt-5">
            <button
              onClick={handleSave}
              disabled={saving || !validation.valid}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wide text-white transition cursor-pointer shadow-md ${
                validation.valid
                  ? "bg-slate-900 hover:bg-slate-800 active:translate-y-0.5 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  : "bg-slate-300 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
              }`}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
