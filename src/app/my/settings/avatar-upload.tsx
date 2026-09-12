"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Camera, Upload, Pencil, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { Modal, ModalTitle } from "@/components/ui/modal";
import { ImageCropper } from "@/components/ui/image-cropper";
import { updateAvatarAction } from "./actions";
import type { User } from "@/db/schema";

interface AvatarUploadProps {
  user: User;
}

export function AvatarUpload({ user }: AvatarUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB for processing)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    // Create object URL for preview
    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setShowUploadModal(false);
    setShowCropper(true);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processFile(file);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleCrop = async (croppedBlob: Blob) => {
    setIsUploading(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // Send to server action
        const result = await updateAvatarAction(base64);

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Avatar updated!");
          router.refresh();
        }

        setShowCropper(false);
        setSelectedImage(null);
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to process image");
        setIsUploading(false);
      };
      reader.readAsDataURL(croppedBlob);
    } catch {
      toast.error("Failed to upload avatar");
      setIsUploading(false);
    }
  };

  const handleCancelCropper = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }
    setSelectedImage(null);
    setShowCropper(false);
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleTakePhoto = () => {
    cameraInputRef.current?.click();
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Avatar with edit icon */}
      <div className="relative inline-block">
        <Avatar name={user.name} avatar={user.avatar} seed={user.username ?? user.id} size="xl" />
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="absolute bottom-0 right-0 w-8 h-8 bg-primary hover:bg-primary-focus rounded-full flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          aria-label="Edit avatar"
        >
          <Pencil className="w-4 h-4 text-primary-content" />
        </button>
      </div>

      {/* Upload options modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <ModalTitle>Change Avatar</ModalTitle>
        <div className="mt-4 space-y-4">
          {/* Drag and drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-base-content/30 hover:border-base-content/50"
            }`}
          >
            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-base-content/50" />
            <p className="text-base-content/70 mb-1">
              Drag and drop an image here
            </p>
            <p className="text-sm text-base-content/50">or use the options below</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTakePhoto}
              className="w-full justify-center"
            >
              <Camera className="w-5 h-5 mr-2" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectFile}
              className="w-full justify-center"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload File
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image cropper modal */}
      <Modal open={showCropper} onClose={handleCancelCropper}>
        <ModalTitle>Edit Avatar</ModalTitle>
        <div className="mt-4 relative">
          {selectedImage && (
            <ImageCropper
              imageSrc={selectedImage}
              onCrop={handleCrop}
              onCancel={handleCancelCropper}
              cropSize={256}
            />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 rounded-lg">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
