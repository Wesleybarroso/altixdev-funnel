# Chanify próprio no EasyPanel

Este guia hospeda o **servidor Chanify** separadamente do site Altixdev. O site continua hospedado normalmente; apenas as notificações passam pelo novo endpoint `https://alertas.altixdev.com.br`.

> O Chanify é distribuído sob licença MIT e suporta execução com Docker. O EasyPanel pode executar uma imagem Docker, manter um volume persistente e publicar um domínio HTTPS para o serviço. [1] [2]

## 1. Preparar o endereço público

O subdomínio definido é `alertas.altixdev.com.br`. No provedor de DNS do domínio, crie um registro **A** apontando esse subdomínio para o IP do servidor onde o EasyPanel está instalado.

| Campo DNS | Valor de exemplo |
|---|---|
| Tipo | `A` |
| Nome | `alertas` |
| Destino | IP público do servidor EasyPanel |
| TTL | Automático ou `3600` |

Espere o DNS propagar antes de continuar. O endereço deve usar HTTPS quando for ligado ao serviço no EasyPanel.

## 2. Criar o serviço no EasyPanel

No EasyPanel, crie um projeto chamado `altixdev-notificacoes`. Em seguida, crie um serviço **Compose**, escolha a origem **Inline** e cole este conteúdo:

```yaml
services:
  chanify:
    image: wizjin/chanify:latest
    command:
      - serve
      - --host=0.0.0.0
      - --port=8080
      - --name=Altixdev Chanify
      - --datapath=/data
      - --endpoint=${CHANIFY_ENDPOINT}
    volumes:
      - chanify-data:/data

volumes:
  chanify-data:
```

Na área **Environment**, cadastre:

```dotenv
CHANIFY_ENDPOINT=https://alertas.altixdev.com.br
```

Em seguida, toque em **Deploy**.

## 3. Conectar domínio e HTTPS

Depois do deploy, abra **Domains** no serviço Compose e adicione `alertas.altixdev.com.br`. Direcione esse domínio ao serviço interno `chanify` na porta `8080` e habilite HTTPS/certificado no próprio EasyPanel.

O EasyPanel recomenda usar seus domínios para tráfego HTTP e HTTPS, em vez de expor portas diretamente. [2]

## 4. Adicionar o servidor ao app Chanify

Abra no navegador do computador ou celular:

```text
https://alertas.altixdev.com.br/
```

O endereço do nó pode ser lido pelo aplicativo Chanify via QR Code. No iPhone, abra **Nodes → +** e escaneie o QR Code mostrado pelo seu próprio servidor. Depois crie um canal `Altixdev`, abra os detalhes do canal e copie o token.

## 5. Conectar ao painel Altixdev

No Altixdev, entre em **Painel → Integrações → Notificações Chanify** e preencha:

| Campo | Valor |
|---|---|
| Servidor Chanify | `https://alertas.altixdev.com.br` |
| Token Chanify | Token copiado no canal Altixdev |
| Alertas automáticos | Ativado |

Salve e clique em **Testar no celular**. O status deve ficar como **Saudável**. Não compartilhe o token no chat, em código ou nos logs.

## Cuidados operacionais

O volume `chanify-data` é obrigatório porque os dados do nó não devem ficar apenas no sistema de arquivos temporário do contêiner. O EasyPanel alerta que alterações fora de volumes podem ser perdidas quando um serviço é recriado. [2]

Antes de apagar ou recriar o serviço, faça backup do volume. Depois do primeiro teste bem-sucedido, mantenha o domínio com HTTPS válido e revise periodicamente os logs do serviço e a disponibilidade do certificado.

## Referências

[1]: https://github.com/chanify/chanify
[2]: https://easypanel.io/docs/services/compose
