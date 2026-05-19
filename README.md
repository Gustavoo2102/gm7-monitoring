# GM7 Signage Dashboard

Dashboard de monitoramento de players com assistente IA integrado.

---

## Como subir no Render (passo a passo)

### 1. Crie as contas
- **GitHub**: https://github.com/signup
- **Render**: https://render.com (entre com o GitHub)
- **Anthropic**: https://console.anthropic.com (para a API key da IA)

---

### 2. Suba o código no GitHub

1. Acesse https://github.com/new
2. Crie um repositório com o nome `gm7-dashboard` (pode ser privado)
3. No seu computador, abra o terminal na pasta do projeto e rode:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gm7-dashboard.git
git push -u origin main
```

---

### 3. Configure no Render

1. Acesse https://dashboard.render.com
2. Clique em **New → Web Service**
3. Conecte seu repositório GitHub `gm7-dashboard`
4. Configure assim:
   - **Name**: gm7-dashboard
   - **Region**: qualquer (Ohio ou Frankfurt são boas opções)
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Role até **Environment Variables** e adicione:

| Key             | Value                          |
|-----------------|--------------------------------|
| SIGNAGE_TOKEN   | (sua key do GM7 Signage)       |
| ANTHROPIC_KEY   | (sua key da Anthropic)         |

6. Clique em **Create Web Service**

---

### 4. Acesse o dashboard

Após o deploy (leva ~2 minutos), o Render vai gerar uma URL tipo:
```
https://gm7-dashboard.onrender.com
```

Acesse essa URL no browser — o dashboard já estará funcionando!

---

## Atualizar o código depois

Sempre que quiser atualizar, basta rodar no terminal:
```bash
git add .
git commit -m "atualização"
git push
```
O Render faz o redeploy automaticamente.

---

## Estrutura dos arquivos

```
gm7-dashboard/
├── server.js          # Backend Node.js (proxy para GM7 + IA)
├── package.json       # Dependências
├── render.yaml        # Config do Render
└── public/
    └── index.html     # Frontend do dashboard
```
