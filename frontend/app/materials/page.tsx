'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ShieldCheck, FileText, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';

interface StudyMaterialItem {
  id: string;
  title: string;
  description: string;
  material_type: string;
  subject_name?: string;
  chapter_name?: string;
  file_size_bytes: number;
  download_url?: string;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<StudyMaterialItem[]>('/materials/')
      .then((data) => {
        if (!isMounted) return;
        setMaterials(asList<StudyMaterialItem>(data));
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'PDF';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Study Materials & Notes</h1>
        <p className="text-sm text-slate-400">PDF Formula sheets, Revision Handouts, and Practice Sheets stored securely</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : materials.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-slate-900/50 border-slate-800">
          <FileText className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Study Materials Uploaded Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Faculty notes, formula maps, and revision handouts will appear here once uploaded.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((mat) => (
            <Card key={mat.id} hoverEffect className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={mat.material_type === 'FORMULA' ? 'purple' : 'blue'}>
                  {mat.subject_name || mat.material_type}
                </Badge>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatFileSize(mat.file_size_bytes)}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100 line-clamp-1">{mat.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {mat.description || (mat.chapter_name ? `Chapter: ${mat.chapter_name}` : 'Study resource')}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Resource
                </span>
                {mat.download_url ? (
                  <a
                    href={mat.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
