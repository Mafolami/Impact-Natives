import { useLocation } from "wouter";

const TYPE_LABELS: Record<string, string> = {
  weekly_sector_match: "Weekly sector match emails",
  partner_match:       "Partner match suggestions",
  newsletter:          "Native Signal",
};

export default function UnsubscribePage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const type   = params.get("type");

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f9fafb" }}>
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <img
          src="https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png"
          alt="Impact Natives"
          className="h-7 mx-auto mb-8"
        />
        {status === "success" ? (
          <>
            <div className="w-10 h-10 rounded-full bg-[#eaf5ee] flex items-center justify-center mx-auto mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Unsubscribed</h1>
            <p className="text-sm text-gray-500 mb-6">
              You have been unsubscribed from{" "}
              <span className="font-medium text-gray-700">
                {TYPE_LABELS[type ?? ""] ?? "these emails"}
              </span>
              . You can update your preferences at any time in your account settings.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/settings")}
              className="text-sm font-semibold text-[#2D6A4F] hover:underline underline-offset-2">
              Manage notification preferences →
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid link</h1>
            <p className="text-sm text-gray-500 mb-6">
              This unsubscribe link is not valid. If you want to update your notification preferences, sign in to your account.
            </p>
            <button
              type="button"
              onClick={() => navigate("/signin")}
              className="text-sm font-semibold text-[#2D6A4F] hover:underline underline-offset-2">
              Sign in →
            </button>
          </>
        )}
      </div>
    </div>
  );
}