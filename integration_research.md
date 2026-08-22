# Referências de integrações externas

- Google recomenda credenciais de conta de serviço para interações servidor-a-servidor e enfatiza o armazenamento seguro da chave privada. Fonte: https://developers.google.com/identity/protocols/oauth2/service-account
- A API do Google Sheets deve ser habilitada em um projeto Google Cloud; o acesso requer um modelo de autenticação apropriado. Fonte: https://developers.google.com/sheets/api/quickstart/nodejs
- O ntfy aceita publicação direta por HTTP POST ou PUT, com suporte a cabeçalhos de título, prioridade, tags e autenticação por token. Os tópicos devem ser difíceis de adivinhar. Fonte: https://docs.ntfy.sh/publish/
- O quickstart oficial da Google Analytics Data API permite autenticação com conta de serviço, requer habilitar a Data API no projeto Google Cloud e conceder a essa conta acesso à propriedade GA4 no Google Analytics. A chamada `runReport` é adequada para obter métricas agregadas da propriedade. Fonte: https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart
- O aplicativo Chanify para iPhone recebe notificações via API e token de acesso, permite personalizar canais, funciona em iPhone/iPad/Mac/Apple Watch e declara não coletar dados segundo a ficha da App Store. Fonte: https://apps.apple.com/us/app/chanify/id1531546573
- A documentação oficial do Chanify informa o envio por `POST` para `https://api.chanify.net/v1/sender/{token}` com o campo `text` em formulário. Fonte: https://www.chanify.net/
