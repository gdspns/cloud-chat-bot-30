import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');
    const fileId = url.searchParams.get('fileId');
    const botId = url.searchParams.get('botId');

    if (!botId || (!imageUrl && !fileId)) {
      return new Response(JSON.stringify({ error: 'Missing botId and url/fileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 获取机器人信息
    const { data: activation, error } = await supabase
      .from('bot_activations')
      .select('bot_token')
      .eq('id', botId)
      .maybeSingle();

    if (error || !activation) {
      return new Response(JSON.stringify({ error: 'Bot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let telegramUrl = '';

    if (fileId) {
      // 优先使用 file_id：调用 getFile API 获取最新的 file_path
      const getFileRes = await fetch(
        `https://api.telegram.org/bot${activation.bot_token}/getFile?file_id=${fileId}`
      );
      const getFileData = await getFileRes.json();

      if (getFileData.ok && getFileData.result.file_path) {
        telegramUrl = `https://api.telegram.org/file/bot${activation.bot_token}/${getFileData.result.file_path}`;
      } else {
        console.error('getFile failed:', getFileData);
        return new Response(JSON.stringify({ error: 'Failed to get file path from Telegram' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (imageUrl) {
      // 兼容旧格式：从 URL 提取 file_path
      const filePathMatch = imageUrl.match(/\/file\/bot[^\/]+\/(.+)$/);
      if (!filePathMatch) {
        return new Response(JSON.stringify({ error: 'Invalid image URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      telegramUrl = `https://api.telegram.org/file/bot${activation.bot_token}/${filePathMatch[1]}`;
    }

    console.log('Fetching image from:', telegramUrl);

    // 获取图片
    const imageResponse = await fetch(telegramUrl);
    
    if (!imageResponse.ok) {
      console.error('Failed to fetch image:', imageResponse.status);
      return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
        status: imageResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageData = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });

  } catch (error) {
    console.error('Get image error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});