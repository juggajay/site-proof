import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, CornerDownRight, Edit2, Trash2, X, Check, Paperclip, Download, FileText, Image } from 'lucide-react'
import { getAuthToken, useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface CommentAuthor {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}

interface CommentAttachment {
  id: string
  filename: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
}

interface Comment {
  id: string
  content: string
  authorId: string
  author: CommentAuthor
  parentId: string | null
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  attachments?: CommentAttachment[]
  replies?: Comment[]
}

interface CommentsSectionProps {
  entityType: string
  entityId: string
}

// Pending attachment interface (before upload)
interface PendingAttachment {
  file: File
  preview?: string
}

export function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Attachment state
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replyFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchComments()
  }, [entityType, entityId])

  // Feature #736: Real-time comment notification polling
  // Poll for new comments every 15 seconds (more frequent for chat-like experience)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null

    const silentFetchComments = async () => {
      try {
        const token = getAuthToken()
        const response = await fetch(
          `${API_URL}/api/comments?entityType=${entityType}&entityId=${entityId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )

        if (response.ok) {
          const data = await response.json()
          const newComments = data.comments || []

          // Only update if there are actual changes
          setComments((prevComments: Comment[]) => {
            // Check if comments have changed by comparing lengths and IDs
            const hasChanges = newComments.length !== prevComments.length ||
              newComments.some((newComment: Comment, index: number) =>
                !prevComments[index] ||
                newComment.id !== prevComments[index].id ||
                newComment.isEdited !== prevComments[index].isEdited ||
                (newComment.replies?.length || 0) !== (prevComments[index].replies?.length || 0)
              )
            return hasChanges ? newComments : prevComments
          })
        }
      } catch (err) {
        // Silent fail for background polling
        console.debug('Background comments fetch failed:', err)
      }
    }

    const startPolling = () => {
      // Poll every 15 seconds for comments (more frequent for chat-like experience)
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchComments()
        }
      }, 15000)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchComments()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [entityType, entityId])

  const fetchComments = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = getAuthToken()
      const response = await fetch(
        `${API_URL}/api/comments?entityType=${entityType}&entityId=${entityId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      } else {
        setError('Failed to load comments')
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  // File validation constants
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds the 10MB size limit.`
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File "${file.name}" is not a supported format. Allowed: images, PDF, Word, Excel, text files.`
    }
    return null
  }

  // Handle file selection for main comment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newAttachments: PendingAttachment[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const error = validateFile(file)
      if (error) {
        errors.push(error)
        continue
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      newAttachments.push({ file, preview })
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error'
      })
    }

    if (newAttachments.length > 0) {
      setPendingAttachments(prev => [...prev, ...newAttachments])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle file selection for reply
  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newAttachments: PendingAttachment[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const error = validateFile(file)
      if (error) {
        errors.push(error)
        continue
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      newAttachments.push({ file, preview })
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error'
      })
    }

    if (newAttachments.length > 0) {
      setReplyAttachments(prev => [...prev, ...newAttachments])
    }

    // Reset input
    if (replyFileInputRef.current) {
      replyFileInputRef.current.value = ''
    }
  }

  // Remove pending attachment
  const removePendingAttachment = (index: number, isReply = false) => {
    if (isReply) {
      setReplyAttachments(prev => {
        const newArr = [...prev]
        if (newArr[index].preview) URL.revokeObjectURL(newArr[index].preview!)
        newArr.splice(index, 1)
        return newArr
      })
    } else {
      setPendingAttachments(prev => {
        const newArr = [...prev]
        if (newArr[index].preview) URL.revokeObjectURL(newArr[index].preview!)
        newArr.splice(index, 1)
        return newArr
      })
    }
  }

  // Upload files to get URLs (mock implementation - in production would use cloud storage)
  const uploadFiles = async (files: PendingAttachment[]): Promise<{ filename: string; fileUrl: string; fileSize: number; mimeType: string }[]> => {
    // In a real implementation, this would upload to S3/CloudStorage
    // For now, we'll create data URLs for demo purposes
    const results = []
    for (const { file } of files) {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      results.push({
        filename: file.name,
        fileUrl: dataUrl,
        fileSize: file.size,
        mimeType: file.type,
      })
    }
    return results
  }

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || submitting) return

    setSubmitting(true)

    try {
      // Upload any pending attachments
      let attachments: { filename: string; fileUrl: string; fileSize: number; mimeType: string }[] = []
      if (pendingAttachments.length > 0) {
        attachments = await uploadFiles(pendingAttachments)
      }

      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entityType,
          entityId,
          content: newComment.trim(),
          attachments,
        }),
      })

      if (response.ok) {
        setNewComment('')
        // Clean up previews
        pendingAttachments.forEach(att => {
          if (att.preview) URL.revokeObjectURL(att.preview)
        })
        setPendingAttachments([])
        fetchComments()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to post comment')
      }
    } catch (err) {
      console.error('Error posting comment:', err)
      setError('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || submitting) return

    setSubmitting(true)

    try {
      // Upload any pending attachments for reply
      let attachments: { filename: string; fileUrl: string; fileSize: number; mimeType: string }[] = []
      if (replyAttachments.length > 0) {
        attachments = await uploadFiles(replyAttachments)
      }

      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entityType,
          entityId,
          content: replyContent.trim(),
          parentId,
          attachments,
        }),
      })

      if (response.ok) {
        setReplyContent('')
        setReplyingTo(null)
        // Clean up previews
        replyAttachments.forEach(att => {
          if (att.preview) URL.revokeObjectURL(att.preview)
        })
        setReplyAttachments([])
        fetchComments()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to post reply')
      }
    } catch (err) {
      console.error('Error posting reply:', err)
      setError('Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim() || submitting) return

    setSubmitting(true)

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditContent('')
        fetchComments()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update comment')
      }
    } catch (err) {
      console.error('Error updating comment:', err)
      setError('Failed to update comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        fetchComments()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete comment')
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
      setError('Failed to delete comment')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Render comment content with markdown and @mentions
  const renderContent = (content: string) => {
    // Process content line by line for block elements
    const lines = content.split('\n')
    let keyIndex = 0

    const processInlineFormatting = (text: string): (string | JSX.Element)[] => {
      const result: (string | JSX.Element)[] = []

      // Combined pattern for all inline formatting
      // Order matters: check more specific patterns first
      const patterns = [
        // Bold + Italic (***text*** or ___text___)
        { regex: /(\*\*\*|___)(.+?)\1/g, render: (_match: string, _: string, text: string) =>
          <strong key={keyIndex++} className="font-bold italic">{text}</strong>
        },
        // Bold (**text** or __text__)
        { regex: /(\*\*|__)(.+?)\1/g, render: (_match: string, _: string, text: string) =>
          <strong key={keyIndex++} className="font-semibold">{text}</strong>
        },
        // Italic (*text* or _text_)
        { regex: /(\*|_)(.+?)\1/g, render: (_match: string, _: string, text: string) =>
          <em key={keyIndex++} className="italic">{text}</em>
        },
        // Inline code (`code`)
        { regex: /`([^`]+)`/g, render: (_match: string, text: string) =>
          <code key={keyIndex++} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">{text}</code>
        },
        // Strikethrough (~~text~~)
        { regex: /~~(.+?)~~/g, render: (_match: string, text: string) =>
          <span key={keyIndex++} className="line-through">{text}</span>
        },
        // Links ([text](url))
        { regex: /\[([^\]]+)\]\(([^)]+)\)/g, render: (_match: string, text: string, url: string) =>
          <a key={keyIndex++} href={url} target="_blank" rel="noopener noreferrer"
             className="text-primary underline hover:no-underline">{text}</a>
        },
        // @mentions
        { regex: /@([\w.+-]+@[\w.-]+|[\w]+)/g, render: (_match: string, name: string) =>
          <span key={keyIndex++} className="text-primary font-medium bg-primary/10 px-0.5 rounded">@{name}</span>
        },
      ]

      let remaining = text

      // Process each pattern
      for (const { regex, render } of patterns) {
        const newParts: (string | JSX.Element)[] = []

        for (const part of (result.length > 0 ? result : [remaining])) {
          if (typeof part !== 'string') {
            newParts.push(part)
            continue
          }

          let lastIdx = 0
          let match
          regex.lastIndex = 0

          while ((match = regex.exec(part)) !== null) {
            if (match.index > lastIdx) {
              newParts.push(part.slice(lastIdx, match.index))
            }
            newParts.push(render(match[0], match[1], match[2]))
            lastIdx = match.index + match[0].length
          }

          if (lastIdx < part.length) {
            newParts.push(part.slice(lastIdx))
          } else if (lastIdx === 0) {
            newParts.push(part)
          }
        }

        if (newParts.length > 0) {
          result.length = 0
          result.push(...newParts)
        }
      }

      return result.length > 0 ? result : [text]
    }

    const renderedLines = lines.map((line, lineIndex) => {
      // Check for code blocks (we'll handle inline code, not block for simplicity)
      const processed = processInlineFormatting(line)

      return (
        <span key={`line-${lineIndex}`}>
          {processed}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      )
    })

    return <>{renderedLines}</>
  }

  // Render attachments for a comment
  const renderAttachments = (attachments?: CommentAttachment[]) => {
    if (!attachments || attachments.length === 0) return null

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att) => {
          const isImage = att.mimeType?.startsWith('image/')
          return (
            <a
              key={att.id}
              href={att.fileUrl}
              download={att.filename}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border hover:bg-muted transition-colors max-w-[200px]"
            >
              {isImage ? (
                <Image className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{att.filename}</p>
                {att.fileSize && (
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                )}
              </div>
              <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </a>
          )
        })}
      </div>
    )
  }

  // Render pending attachments preview
  const renderPendingAttachments = (attachments: PendingAttachment[], onRemove: (index: number) => void) => {
    if (attachments.length === 0) return null

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((att, index) => (
          <div
            key={index}
            className="relative flex items-center gap-2 p-2 bg-muted/50 rounded-lg border max-w-[180px]"
          >
            {att.preview ? (
              <img src={att.preview} alt="" className="h-8 w-8 object-cover rounded" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-xs truncate flex-1">{att.file.name}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-0.5 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const isAuthor = user?.id === comment.authorId
    const isEditing = editingId === comment.id

    return (
      <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : ''}`}>
        <div className={`rounded-lg border bg-card p-4 ${isReply ? 'border-l-2 border-l-primary/30' : ''}`}>
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {comment.author.avatarUrl ? (
                <img
                  src={comment.author.avatarUrl}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {(comment.author.fullName || comment.author.email).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <span className="font-medium text-sm">
                  {comment.author.fullName || comment.author.email}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatDate(comment.createdAt)}
                  {comment.isEdited && (
                    <span className="ml-1">(edited)</span>
                  )}
                </span>
              </div>
            </div>

            {isAuthor && !isEditing && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingId(comment.id)
                    setEditContent(comment.content)
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  title="Edit comment"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="p-1 text-muted-foreground hover:text-red-600 rounded"
                  title="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setEditingId(null)
                    setEditContent('')
                  }}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleUpdateComment(comment.id)}
                  disabled={!editContent.trim() || submitting}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap">{renderContent(comment.content)}</p>
              {renderAttachments(comment.attachments)}
            </>
          )}

          {/* Reply Button */}
          {!isReply && !isEditing && (
            <div className="mt-3 pt-2 border-t">
              {replyingTo === comment.id ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2" />
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full px-3 py-2 border rounded-lg bg-background resize-none text-sm"
                        rows={2}
                        autoFocus
                      />
                      {renderPendingAttachments(replyAttachments, (i) => removePendingAttachment(i, true))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center ml-6">
                    <div>
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        multiple
                        onChange={handleReplyFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        title="Attach file"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Attach
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyContent('')
                          replyAttachments.forEach(att => {
                            if (att.preview) URL.revokeObjectURL(att.preview)
                          })
                          setReplyAttachments([])
                        }}
                        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyContent.trim() || submitting}
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CornerDownRight className="h-3 w-3" />
                  Reply
                </button>
              )}
            </div>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New Comment Form */}
      <form onSubmit={handleSubmitComment} className="space-y-2">
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (supports **bold**, *italic*, `code`, [links](url))"
            className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Supports: **bold**, *italic*, `code`, ~~strikethrough~~, [link](url), @mentions
          </p>
        </div>
        {renderPendingAttachments(pendingAttachments, (i) => removePendingAttachment(i, false))}
        <div className="flex justify-between items-center">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
              Attach
            </button>
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  )
}
