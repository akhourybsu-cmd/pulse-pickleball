

## Group Image Upload & Storage Plan

### Overview

Enable image uploads for group posts and enhance the existing group files system. The database already has an `image_url` column in `group_posts`, and a `group-files` storage bucket exists. This plan implements the full upload flow for posts and improves the files tab experience.

---

## Current State Analysis

### What Already Exists
- `group_posts.image_url` column (text, nullable)
- `group-files` storage bucket (public)
- `group_files` table for shared files
- `useGroupFiles` hook with upload/delete functionality
- Storage RLS policies for group file uploads

### What's Missing
- Photo upload UI in `QuickPostComposer`
- Image display in post cards
- Dedicated storage structure for post images vs shared files
- Image preview/compression before upload
- Image gallery view in posts

---

## Part 1: Create Group Post Images Storage Bucket

Create a dedicated bucket for post images to separate them from shared group files.

### Database Migration

```sql
-- Create storage bucket for group post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-post-images', 'group-post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Anyone can view group post images
CREATE POLICY "Anyone can view group post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-post-images');

-- RLS: Authenticated group members can upload images
CREATE POLICY "Group members can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-post-images' 
  AND auth.role() = 'authenticated'
);

-- RLS: Uploaders can delete their own images
CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-post-images' 
  AND (auth.uid())::text = owner_id
);
```

---

## Part 2: Create Image Upload Hook

### New File: `src/hooks/useImageUpload.ts`

A reusable hook for image uploads with:
- File validation (type, size)
- Image compression (client-side)
- Upload progress tracking
- Error handling

```typescript
interface UseImageUploadOptions {
  bucket: string;
  maxSizeMB?: number;
  compressionQuality?: number;
  folder?: string;
}

interface UploadResult {
  url: string;
  path: string;
}

export function useImageUpload(options: UseImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const uploadImage = async (file: File): Promise<UploadResult | null> => {
    // Validate file type
    // Compress if needed
    // Upload to storage
    // Return public URL
  };
  
  return { uploadImage, uploading, progress };
}
```

**Features**:
- Accepts images up to 10MB
- Compresses to ~1MB using canvas
- Generates unique filenames
- Returns public URL for database storage

---

## Part 3: Update QuickPostComposer with Photo Upload

### Changes to `src/components/community/QuickPostComposer.tsx`

Replace the "Photo upload coming soon" placeholder with actual functionality.

**New State**:
```typescript
const [selectedImage, setSelectedImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
```

**Photo Tab Enhancement**:
```
┌─────────────────────────────────────────────────────────────┐
│  Caption                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Add a caption...                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │     📸 Tap to add a photo                            │   │
│  │     or drag and drop                                 │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Selected: photo.jpg  ✕ Remove]                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
- Drag & drop zone component
- File input with image/* accept
- Preview thumbnail with remove button
- Upload happens on form submit
- Caption becomes post content

---

## Part 4: Image Preview Component

### New File: `src/components/community/ImageDropzone.tsx`

A reusable dropzone component for image selection.

```typescript
interface ImageDropzoneProps {
  onFileSelect: (file: File) => void;
  preview?: string | null;
  onRemove?: () => void;
  className?: string;
}
```

**Features**:
- Drag & drop support
- Click to select file
- Image preview with aspect ratio preservation
- Remove button overlay
- Drag state visual feedback
- File type validation

---

## Part 5: Update useGroupPosts Hook

### Changes to `src/hooks/useGroupPosts.ts`

Extend `createPost` mutation to accept `image_url`:

```typescript
const createPostMutation = useMutation({
  mutationFn: async (postData: {
    type: GroupPost['type'];
    title?: string;
    content?: string;
    session_date?: string;
    session_time?: string;
    max_players?: number;
    pinned?: boolean;
    image_url?: string;  // Add this
  }) => {
    // ... existing logic
  },
});
```

---

## Part 6: Display Images in Post Cards

### Changes to `src/components/community/GroupFeed.tsx`

Add image display in the `PostCard` component:

```
┌─────────────────────────────────────────────────────────────┐
│  [Avatar] User Name • 5 minutes ago              [⋮ Menu]  │
│  ─────────────────────────────────────────────────────────  │
│  Look at this amazing court setup! 🎾                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │                   [Image Preview]                     │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [👍 ❤️ 🎾 🔥]                              💬 2 comments   │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
```tsx
{post.image_url && (
  <div className="mt-3 -mx-1">
    <img 
      src={post.image_url} 
      alt=""
      className="w-full rounded-lg object-cover max-h-80 cursor-pointer"
      onClick={() => setLightboxImage(post.image_url)}
    />
  </div>
)}
```

---

## Part 7: Image Lightbox Component

### New File: `src/components/community/ImageLightbox.tsx`

Full-screen image viewer when clicking on post images.

```typescript
interface ImageLightboxProps {
  src: string | null;
  onClose: () => void;
}
```

**Features**:
- Full-screen overlay
- Click outside to close
- Keyboard escape to close
- Pinch-to-zoom on mobile
- Download button

---

## Part 8: Enhance GroupFiles Tab

### Changes to `src/components/community/GroupFiles.tsx`

Improve the files tab with:
- Grid/list view toggle
- Image gallery view for photos
- Better thumbnail previews
- Multi-file upload support

**Gallery Mode for Images**:
```
┌─────────────────────────────────────────────────────────────┐
│  [Grid] [List]                           [+ Upload]         │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │  IMG   │  │  IMG   │  │  IMG   │  │  PDF   │            │
│  │        │  │        │  │        │  │  📄    │            │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
│  photo1.jpg  photo2.jpg  photo3.jpg  doc.pdf               │
└─────────────────────────────────────────────────────────────┘
```

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useImageUpload.ts` | Reusable image upload hook with compression |
| `src/components/community/ImageDropzone.tsx` | Drag & drop file selection component |
| `src/components/community/ImageLightbox.tsx` | Full-screen image viewer |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/community/QuickPostComposer.tsx` | Add photo upload functionality |
| `src/hooks/useGroupPosts.ts` | Accept image_url in createPost |
| `src/components/community/GroupFeed.tsx` | Display images in post cards |
| `src/components/community/GroupFiles.tsx` | Add grid view and gallery mode |

### Database Migration

| Change | Purpose |
|--------|---------|
| Create `group-post-images` bucket | Dedicated storage for post images |
| Add storage RLS policies | Secure upload/delete access |

---

## Implementation Flow

```text
User Flow:
1. User clicks Photo chip → Opens QuickPostComposer on Photo tab
2. User drags/selects image → Preview shown
3. User adds optional caption → Types in textarea
4. User clicks Post → Image uploads to storage
5. Post created with image_url → Feed updates
6. Others see image in feed → Click to open lightbox
```

```text
Technical Flow:
1. File selected → Validate type/size
2. Preview generated → URL.createObjectURL()
3. On submit → Compress image (if >1MB)
4. Upload to storage → supabase.storage.from('group-post-images').upload()
5. Get public URL → storage.from().getPublicUrl()
6. Create post → INSERT with image_url
7. Invalidate query → React Query refetch
```

---

## Expected Outcomes

| Feature | Result |
|---------|--------|
| Photo posts | Users can share images with captions |
| Image compression | Large photos auto-compressed to ~1MB |
| Drag & drop | Easy image selection on desktop |
| Lightbox view | Full-screen image viewing |
| Files gallery | Better browsing of shared images |
| Mobile support | Touch-friendly upload on mobile |

---

## Technical Notes

### Image Compression
Using canvas-based compression:
```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Scale down large images
// Compress to JPEG with quality 0.8
```

### Storage Path Structure
```
group-post-images/
  └── {groupId}/
      └── {timestamp}-{random}.jpg
```

### File Size Limits
- Max upload: 10MB
- Compression target: 1MB
- Accepted types: image/jpeg, image/png, image/gif, image/webp

