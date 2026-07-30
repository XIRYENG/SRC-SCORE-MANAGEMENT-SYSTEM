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
  const [savedWeights, setSavedWeights] = useState<GradeWeights>(DEFAULT_GRADE_WEIGHTS);
  const [noScoreHandling, setNoScoreHandling] = useState<'include' | 'exclude'>('include');
  const [savedNoScoreHandling, setSavedNoScoreHandling] = useState<'include' | 'exclude'>('include');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
            const merged = { ...DEFAULT_GRADE_WEIGHTS, ...data.weights };
            setWeights(merged);
            setSavedWeights(merged);
          }
          if (data && data.noScoreHandling) {
            setNoScoreHandling(data.noScoreHandling);
            setSavedNoScoreHandling(data.noScoreHandling);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch grade weights:", err);
        setErrorMsg("Failed to load grade settings from database.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(weights) !== JSON.stringify(savedWeights) || noScoreHandling !== savedNoScoreHandling;
  }, [weights, savedWeights, noScoreHandling, savedNoScoreHandling]);

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

  const handleSave = () => {
    if (!validation.valid) {
      setErrorMsg(validation.errors[0] || "Invalid weights configuration.");
      return;
    }
    setShowConfirmModal(true);
  };

  const executeSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!firestoreDb) {
        throw new Error("Firestore database is not loaded.");
      }

      const docRef = doc(firestoreDb, "system_settings", "grade_calculation");
      await setDoc(docRef, {
        weights,
        noScoreHandling,
        updatedAt: new Date().toISOString(),
      });

      setSavedWeights(weights);
      setSavedNoScoreHandling(noScoreHandling);
      setSuccessMsg("Grade calculation settings saved and applied successfully!");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Error saving settings:", err);
      setErrorMsg(err?.message || "Failed to save settings.");
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
                No-Score Reviewee Handling
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setNoScoreHandling('include')}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    noScoreHandling === 'include'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${noScoreHandling === 'include' ? 'border-white dark:border-slate-900' : 'border-slate-300'}`}>
                    {noScoreHandling === 'include' && <div className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Include as 0.00%</span>
                    <span className="text-[10px] opacity-70">Missing scores count as 0 in aggregates</span>
                  </div>
                </button>

                <button
                  onClick={() => setNoScoreHandling('exclude')}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    noScoreHandling === 'exclude'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${noScoreHandling === 'exclude' ? 'border-white dark:border-slate-900' : 'border-slate-300'}`}>
                    {noScoreHandling === 'exclude' && <div className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Exclude from aggregate</span>
                    <span className="text-[10px] opacity-70">Denominator only includes valid scores</span>
                  </div>
                </button>
              </div>
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

      {/* Floating Unsaved Changes Confirmation Card */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-900 text-white px-5 py-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950 animate-bounce-short">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold">You have unsaved weight changes</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeights(savedWeights)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !validation.valid}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Confirm Save"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Saving Settings */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-base font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" /> Confirm Grade Weight Changes?
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-black text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                You are about to update the official category weights for all reviewees and dashboards. Please review the changes:
              </p>

              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="grid grid-cols-3 text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Category</span>
                  <span className="text-center">Current</span>
                  <span className="text-right">New</span>
                </div>
                {(Object.keys(DEFAULT_GRADE_WEIGHTS) as GradeCategoryKey[]).map((key) => {
                  const currentVal = savedWeights[key] || 0;
                  const newVal = weights[key] || 0;
                  const changed = currentVal !== newVal;
                  return (
                    <div key={key} className={`grid grid-cols-3 items-center text-xs py-1.5 px-2 rounded-xl ${changed ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50' : ''}`}>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{GRADE_CATEGORY_LABELS[key]}</span>
                      <span className="text-center font-medium text-slate-500">{currentVal}%</span>
                      <span className={`text-right font-black ${changed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{newVal}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Total New Weight</span>
                <span className={`font-black ${Math.abs(validation.total - 100) < 0.001 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {validation.total.toFixed(1)}% (Must be 100%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50 transition cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={executeSave}
                disabled={saving || !validation.valid}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50 shadow-md"
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
