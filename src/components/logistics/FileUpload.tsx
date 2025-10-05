
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, XCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface FileUploadProps {
  title: string;
  onFilesSelect: (files: File[]) => void;
  onFileRemove: (fileName: string) => void;
  files: File[];
}

export default function FileUpload({ title, onFilesSelect, onFileRemove, files }: FileUploadProps) {

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesSelect(acceptedFiles);
    }
  }, [onFilesSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    },
    multiple: true,
  });

  return (
    <div className="space-y-2 flex flex-col h-full">
      <h3 className="font-semibold text-foreground text-center text-lg">{title}</h3>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50 transition-colors flex-grow",
          isDragActive ? "border-primary bg-primary/10" : "border-border",
          files.length > 0 ? "border-green-500/50" : ""
        )}
      >
        <input {...getInputProps()} />
        {files.length === 0 ? (
          <div className="flex flex-col items-center text-center text-muted-foreground p-4">
            <UploadCloud className="w-12 h-12 mb-3" />
            {isDragActive ? (
              <p>Déposez les fichiers ici...</p>
            ) : (
              <p>Glissez-déposez ou <span className="font-semibold text-primary">cliquez pour choisir</span></p>
            )}
            <p className="text-xs mt-1">Fichiers .XLSX ou .CSV</p>
          </div>
        ) : (
            <div className='p-2 w-full h-full'>
                <ScrollArea className="h-40 w-full">
                    <ul className="divide-y divide-border">
                        {files.map(file => (
                            <li key={file.name} className="flex items-center justify-between p-2 text-sm">
                                <span className="flex items-center gap-2 truncate">
                                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="truncate" title={file.name}>{file.name}</span>
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => { e.stopPropagation(); onFileRemove(file.name); }}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
        )}
      </div>
    </div>
  );
}
