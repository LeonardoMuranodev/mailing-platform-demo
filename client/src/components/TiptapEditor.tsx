import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import { useCallback, useState } from 'react';

export default function TiptapEditor() {
  const htmlContent = useCampanaStore((state) => state.form.cuerpo_html);
  const setHtmlContent = useCampanaStore((state) => state.setHtmlContent);
  const error = useCampanaStore((state) => state.errors.cuerpo_html);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
    ],
    content: htmlContent,
    onUpdate: ({ editor }) => {
      setHtmlContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'border-t border-border min-h-[200px] focus:outline-none',
      },
    },
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setIsLinkModalOpen(true);
  }, [editor]);

  const confirmLink = () => {
    if (!editor) return;

    let finalUrl = linkUrl.trim();
    if (finalUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setIsLinkModalOpen(false);
      return;
    }

    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    setIsLinkModalOpen(false);
  };

  const closeLinkModal = () => {
    setIsLinkModalOpen(false);
  };

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-md transition-colors flex items-center justify-center
        ${isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-background'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );

  return (
    <div className={`border rounded-lg overflow-hidden bg-surface transition-colors ${error ? 'border-danger' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-background border-b border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita"
        >
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva"
        >
          <Italic size={18} />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1"></div>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Título Principal"
        >
          <Heading1 size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Subtítulo"
        >
          <Heading2 size={18} />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1"></div>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista con viñetas"
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered size={18} />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1"></div>
        <ToolbarButton onClick={openLinkModal} isActive={editor.isActive('link')} title="Insertar Enlace">
          <LinkIcon size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="Quitar Enlace"
        >
          <Unlink size={18} />
        </ToolbarButton>
      </div>

      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
      
      {error && <p className="text-danger text-sm px-3 pb-2">{error}</p>}

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-5 animate-fade-in border border-border">
            <h3 className="text-lg font-semibold text-dark mb-4">Insertar Enlace</h3>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Ej. google.com"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmLink();
                if (e.key === 'Escape') closeLinkModal();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeLinkModal}
                className="px-4 py-2 text-sm font-medium text-muted bg-background rounded-md hover:bg-border transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLink}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
