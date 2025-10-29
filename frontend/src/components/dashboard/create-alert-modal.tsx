"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import MainButton from "@/components/main-button";
import { cn } from "@/lib/utils";

interface CreateAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateAlertModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateAlertModalProps) {
  const [formData, setFormData] = useState({
    alertName: "",
    keywords: "",
    category: "",
    notificationFrequency: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.alertName.trim()) {
      newErrors.alertName = "Alert name is required";
    }

    if (!formData.keywords.trim()) {
      newErrors.keywords = "Keywords are required";
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    if (!formData.notificationFrequency) {
      newErrors.notificationFrequency = "Notification frequency is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // TODO: Replace with actual API call
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reset form
      setFormData({
        alertName: "",
        keywords: "",
        category: "",
        notificationFrequency: "",
      });
      setErrors({});

      // Close modal and call success callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create alert:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        alertName: "",
        keywords: "",
        category: "",
        notificationFrequency: "",
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Alert</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Alert Name */}
          <div className="space-y-2">
            <label
              htmlFor="alertName"
              className="text-sm font-medium text-foreground"
            >
              Alert Name
            </label>
            <Input
              id="alertName"
              type="text"
              placeholder="e.g., DoD IT Opportunities"
              value={formData.alertName}
              onChange={(e) => handleChange("alertName", e.target.value)}
              error={!!errors.alertName}
              errorMessage={errors.alertName}
              disabled={isSubmitting}
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <label
              htmlFor="keywords"
              className="text-sm font-medium text-foreground"
            >
              Keywords
            </label>
            <Input
              id="keywords"
              type="text"
              placeholder="IT Services, Cloud Computing"
              value={formData.keywords}
              onChange={(e) => handleChange("keywords", e.target.value)}
              error={!!errors.keywords}
              errorMessage={errors.keywords}
              disabled={isSubmitting}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="category"
              className="text-sm font-medium text-foreground"
            >
              Category
            </label>
            <Select
              id="category"
              value={formData.category}
              onChange={(e) => handleChange("category", e.target.value)}
              error={!!errors.category}
              errorMessage={errors.category}
              disabled={isSubmitting}
            >
              <option value="">Select category</option>
              <option value="it">IT Services</option>
              <option value="cloud">Cloud Computing</option>
              <option value="cybersecurity">Cybersecurity</option>
              <option value="healthcare">Healthcare IT</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="data-analytics">Data Analytics</option>
            </Select>
          </div>

          {/* Notification Frequency */}
          <div className="space-y-2">
            <label
              htmlFor="notificationFrequency"
              className="text-sm font-medium text-foreground"
            >
              Notification Frequency
            </label>
            <Select
              id="notificationFrequency"
              value={formData.notificationFrequency}
              onChange={(e) =>
                handleChange("notificationFrequency", e.target.value)
              }
              error={!!errors.notificationFrequency}
              errorMessage={errors.notificationFrequency}
              disabled={isSubmitting}
            >
              <option value="">Select frequency</option>
              <option value="real-time">Real-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <MainButton
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Alert"}
            </MainButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

