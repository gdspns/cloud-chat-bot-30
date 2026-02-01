import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export const Activate = () => {
  const { t } = useLanguage();
  const { activationCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async () => {
    if (!botToken.trim()) {
      toast({
        title: t('activate.error'),
        description: t('activate.enterToken'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-bot', {
        body: {
          action: 'authorize',
          activationCode,
          botToken: botToken.trim(),
        }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: t('activate.success'),
        description: t('activate.successDesc'),
      });

      // Navigate to console
      setTimeout(() => {
        navigate(`/console/${data.data.id}`);
      }, 1500);
    } catch (error: any) {
      toast({
        title: t('activate.failed'),
        description: error.message || t('activate.checkToken'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('activate.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('activate.desc')}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('activate.code')}</label>
            <Input
              value={activationCode || ""}
              disabled
              className="mt-2 bg-muted"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('activate.token')}</label>
            <Input
              placeholder={t('activate.tokenPlaceholder')}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleActivate()}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('activate.tokenHint')}
            </p>
          </div>
          <Button 
            onClick={handleActivate} 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? t('activate.activating') : (
              <>
                {t('activate.submit')} <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-medium text-sm mb-2">{t('activate.guideTitle')}</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>{t('activate.guide1')}</li>
            <li>{t('activate.guide2')}</li>
            <li>{t('activate.guide3')}</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default Activate;