# Acompanhamento de voo da tripulação

Acesso: Meus voos > abrir voo > Acompanhar voo.

A tela usa mapa escuro, avião orientado pelo rumo, trilha real, origem/destino, zoom e centralização. Arrastar o mapa desativa a centralização automática. A linha pontilhada é a referência direta entre origem e destino; não é uma rota IFR. Progresso e ETA são estimativas pela distância geodésica até o destino e velocidade sobre o solo; a ETA só aparece com posição atual e velocidade >= 30 kt.

## Fontes e conexão

- ADS-B: consulta autenticada a cada 15 segundos enquanto a tela está aberta e o app está ativo. Posição com mais de 30 segundos deixa de ser atual. Perda de conexão conserva a última posição identificada como antiga, sem velocidade/ETA ao vivo.
- GPS local: ativação expressa e permissão de localização somente durante o uso. A captura para ao sair da tela ou colocar o app em segundo plano. Precisão acima de 200 m é rejeitada. Altitude GPS e ADS-B são identificadas pela fonte.
- Offline: mapa básico mundial Natural Earth já incluído no app (não depende de tiles). A rota deve ser aberta com internet antes do voo para ser salva. O cache é separado por conta/voo e removido ao sair da conta. Uma sessão expirada pode restaurar a interface offline, mas continua impedida de autorizar chamadas sem renovação.
- Cada ponto GPS tem ID estável e timestamp de captura. A fila envia até 100 pontos por consulta e só remove os IDs confirmados pelo Worker. Máximo de 5.000 pontos pendentes; ao atingir, a captura pausa e informa o motivo. Pontos com mais de sete dias ficam apenas no histórico local, com aviso na abertura.

O mapa básico contém o contorno terrestre global de Natural Earth em 1:110m, arredondado a duas casas decimais, sem cartas aeronáuticas ou malha de ruas. Fonte: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson . Termos: https://www.naturalearthdata.com/about/terms-of-use/ (domínio público).

## Publicação e testes

Publicar primeiro as rotas/migração GPS do backend; depois distribuir um novo build do app, pois há módulos nativos novos (`expo-location` e `react-native-svg`). Não é feita gravação de horários ou assinatura de diário a partir do GPS.

TypeScript, testes de distância/idade/projeção/segmentos e sessão offline; bundle web com fixtures para acompanhamento ADS-B, perda de rede, GPS e confirmação de fila; exportações Android/iOS. A recepção GPS dentro da aeronave e o teste de modo avião exigem aparelho físico.
