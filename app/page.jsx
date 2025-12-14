"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const messageClass = useMemo(() => {
    if (!status) return "hidden";
    return status.type === "error"
      ? "col-span-full mt-2 rounded-lg p-4 text-sm bg-red-100 text-red-700"
      : "col-span-full mt-2 rounded-lg p-4 text-sm bg-green-100 text-green-700";
  }, [status]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim();

    if (!name || !email) {
      setStatus({ type: "error", message: "Please fill in your name and email." });
      return;
    }

    try {
      setSubmitting(true);
      setStatus(null);

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (jsonErr) {
        console.error("Failed to parse waitlist response", jsonErr);
      }

      if (!response.ok || payload?.error) {
        const message = payload?.error || "Failed to save. Please try again.";
        setStatus({ type: "error", message });
        return;
      }

      if (payload?.duplicate) {
        setStatus({ type: "success", message: "You're already on the list. Thanks for checking!" });
      } else {
        setStatus({ type: "success", message: "You're on the waiting list! We'll keep you posted." });
      }

      form.reset();
    } catch (err) {
      console.error("Waitlist submit error", err);
      setStatus({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white relative isolate overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-4 sm:p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <div className="-m-1.5 p-1.5">
              <span className="sr-only">Groopin</span>
              <img src="/assets/images/logo.png" className="h-10 sm:h-12 w-auto" alt="Groopin logo" />
            </div>
          </div>
        </nav>
      </header>

      <div className="relative pt-20 sm:pt-24 lg:pt-28">
        <svg
          className="absolute inset-0 -z-10 opacity-25 size-full stroke-gray-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern id="83fd4e5a-9d52-42fc-97b6-718e5d7ee527" width="200" height="200" x="50%" y="-1" patternUnits="userSpaceOnUse">
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y="-1" className="overflow-visible fill-gray-50">
            <path d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z" strokeWidth="0" />
          </svg>
          <rect width="100%" height="100%" strokeWidth="0" fill="url(#83fd4e5a-9d52-42fc-97b6-718e5d7ee527)" />
        </svg>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-28 lg:flex lg:items-center lg:gap-x-12">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div className="flex">
              <div className="relative flex items-center gap-x-3 rounded-full bg-white px-4 py-1 text-sm/6 text-gray-600 ring-1 ring-gray-900/10 shadow-sm">
                <span className="absolute inset-0" aria-hidden="true"></span>
                We're launching soon
              </div>
            </div>

            <h1 className="mt-8 text-pretty text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-groopinPurple">
              Where paths cross, adventures begin
            </h1>

            <div className="mt-6 sm:mt-8 text-pretty text-base sm:text-lg font-medium text-gray-500 space-y-4">
              <p>
                Looking to share the things you love with others? <span className="text-groopinPink font-bold">Groopin</span> makes it easy.
                With <span className="text-groopinPink font-bold">Groopin</span>, connect with like-minded people and share your passions across
                categories like sports, culture, travel, and dining.
              </p>
              <ul className="text-gray-500 list-disc list-inside space-y-1">
                <li>Create or join activities in seconds.</li>
                <li>Meet, share, and build connections.</li>
                <li>Transform passions into unforgettable experiences.</li>
              </ul>
              <p>Join the waiting list to be the first to experience Groopin!</p>
            </div>

            <div className="mt-8 sm:mt-10">
              <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 w-full">
                <div>
                  <label htmlFor="name" className="block text-base/6 font-medium text-gray-900">
                    Name
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      className="block w-full rounded-md bg-white px-4 py-3 text-base text-gray-900 outline outline-1 -outline-offset-1 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-groopinPurple sm:text-base/6 outline-gray-300"
                      placeholder="Khalid BOUZIANE"
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-base/6 font-medium text-gray-900">
                    Email
                  </label>
                  <div className="mt-2">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      className="block w-full rounded-md bg-white px-4 py-3 text-base text-gray-900 outline outline-1 -outline-offset-1 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-groopinPurple sm:text-base/6 outline-gray-300"
                      placeholder="khalid@gmail.com"
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="col-span-full inline-flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-gradient-to-r from-groopinPurple to-groopinPink rounded-lg shadow-lg hover:from-groopinPink hover:to-groopinPurple transition w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Join the waiting list"}
                </button>

                <div className={messageClass} role="alert" aria-live="polite">
                  {status?.message}
                </div>
              </form>
            </div>
          </div>

          <div className="mt-12 sm:mt-16 lg:mt-0 lg:shrink-0 lg:grow">
            <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
              <svg viewBox="0 0 366 729" role="img" className="mx-auto w-full max-w-[22.875rem] drop-shadow-xl">
                <title>App screenshot</title>
                <defs>
                  <clipPath id="2ade4387-9c63-4fc4-b754-10e687a0d332">
                    <rect width="316" height="684" rx="36" />
                  </clipPath>
                </defs>
                <path
                  fill="#4B5563"
                  d="M363.315 64.213C363.315 22.99 341.312 1 300.092 1H66.751C25.53 1 3.528 22.99 3.528 64.213v44.68l-.857.143A2 2 0 0 0 1 111.009v24.611a2 2 0 0 0 1.671 1.973l.95.158a2.26 2.26 0 0 1-.093.236v26.173c.212.1.398.296.541.643l-1.398.233A2 2 0 0 0 1 167.009v47.611a2 2 0 0 0 1.671 1.973l1.368.228c-.139.319-.314.533-.511.653v16.637c.221.104.414.313.56.689l-1.417.236A2 2 0 0 0 1 237.009v47.611a2 2 0 0 0 1.671 1.973l1.347.225c-.135.294-.302.493-.49.607v377.681c0 41.213 22 63.208 63.223 63.208h95.074c.947-.504 2.717-.843 4.745-.843l.141.001h.194l.086-.001 33.704.005c1.849.043 3.442.37 4.323.838h95.074c41.222 0 63.223-21.999 63.223-63.212v-394.63c-.259-.275-.48-.796-.63-1.47l-.011-.133 1.655-.276A2 2 0 0 0 366 266.62v-77.611a2 2 0 0 0-1.671-1.973l-1.712-.285c.148-.839.396-1.491.698-1.811V64.213Z"
                />
                <path
                  fill="#343E4E"
                  d="M16 59c0-23.748 19.252-43 43-43h246c23.748 0 43 19.252 43 43v615c0 23.196-18.804 42-42 42H58c-23.196 0-42-18.804-42-42V59Z"
                />
                <foreignObject width="316" height="684" transform="translate(24 24)" clipPath="url(#2ade4387-9c63-4fc4-b754-10e687a0d332)">
                  <img src="/assets/images/home-screen.png" alt="Groopin app home" className="w-full h-full object-cover" />
                </foreignObject>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
