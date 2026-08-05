"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, Label, FieldError } from "@/components/ui/form-fields";

const reviewRequestFormSchema = z.object({
  message: z.string().trim().max(2000).optional(),
});
type ReviewRequestFormValues = z.infer<typeof reviewRequestFormSchema>;

interface ReviewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  brandName: string;
  locationLabel: string | null;
  territorySearchId: string | null;
}

export function ReviewRequestModal({
  open,
  onOpenChange,
  token,
  brandName,
  locationLabel,
  territorySearchId,
}: ReviewRequestModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewRequestFormValues>({ resolver: zodResolver(reviewRequestFormSchema) });

  async function onSubmit(values: ReviewRequestFormValues) {
    setServerError(null);
    try {
      const response = await fetch(`/api/portal/${token}/territory-advisor/review-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territorySearchId: territorySearchId ?? undefined, message: values.message }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setServerError(data.error ?? "Your request could not be submitted. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Your request could not be submitted. Please check your connection and try again.");
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset after the close animation would run, if there were one.
      setTimeout(() => {
        setSubmitted(false);
        setServerError(null);
        reset();
      }, 150);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-9 text-success" strokeWidth={1.6} />
            <p className="text-[15.5px] font-bold text-foreground">
              Your territory review request has been submitted.
            </p>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              A member of the GenDev team will review the market and follow up with you. Territory
              availability is not confirmed until you receive written approval from the franchisor
              or its authorized representative.
            </p>
            <Button type="button" className="mt-2" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request Territory Review</DialogTitle>
              <DialogDescription>
                A member of the GenDev team will take a closer look at{" "}
                {locationLabel ? <strong className="text-foreground">{locationLabel}</strong> : "this market"}{" "}
                for {brandName} and follow up with you directly.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="review-message">Anything else we should know? (optional)</Label>
                <Textarea
                  id="review-message"
                  className="mt-1.5"
                  rows={3}
                  placeholder="Tell us anything else about the area you are considering."
                  aria-invalid={Boolean(errors.message)}
                  {...register("message")}
                />
                <FieldError message={errors.message?.message} />
              </div>

              {serverError && (
                <div role="alert" className="rounded-control border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {serverError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  {isSubmitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
