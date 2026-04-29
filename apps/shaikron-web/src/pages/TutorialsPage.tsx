import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/apiClient";


interface Tutorial {
  id: string;
  titulo: string;
  descricao?: string;
  videoUrl: string;
  categoria: string;
  ordem: number;
  obrigatorio: boolean;
}

const CATEGORIAS = ["primeiros_passos", "configuracao", "whatsapp", "agenda", "relatorios"];

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function getThumbnail(url: string): string {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const id = getYoutubeId(url);
  if (!id) return null;

  if (playing) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      className="relative w-full aspect-video rounded-lg overflow-hidden bg-black group"
      onClick={() => setPlaying(true)}
    >
      <img
        src={getThumbnail(url)}
        alt={title}
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg group-hover:scale-110 transition-transform">
          <svg className="h-6 w-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default function TutorialsPage() {
  const { t } = useLanguage();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);

  useEffect(() => {
    api.get<Tutorial[]>("/tutorials/public").then(setTutorials).catch(() => {});
  }, []);

  const byCategory = CATEGORIAS.map((cat) => ({
    key: cat,
    label: t(`tutorials.cat.${cat}`),
    items: tutorials.filter((t) => t.categoria === cat).sort((a, b) => a.ordem - b.ordem),
  })).filter((c) => c.items.length > 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("tutorials.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tutorials.subtitle")}</p>
          </div>
        </div>

        {byCategory.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("tutorials.noItems")}</p>
            </CardContent>
          </Card>
        )}

        {byCategory.map((cat) => (
          <div key={cat.key} className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
              {cat.label}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {cat.items.map((tut) => (
                <Card
                  key={tut.id}
                  className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
                >
                  <VideoEmbed url={tut.videoUrl} title={tut.titulo} />
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <h3 className="font-semibold text-foreground flex-1 leading-tight">{tut.titulo}</h3>
                      {tut.obrigatorio && (
                        <Badge className="text-xs shrink-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {t("tutorials.required")}
                        </Badge>
                      )}
                    </div>
                    {tut.descricao && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{tut.descricao}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
