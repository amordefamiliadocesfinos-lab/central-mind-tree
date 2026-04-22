# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/1720a410-34cd-4410-995c-8c92c7edf16b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/1720a410-34cd-4410-995c-8c92c7edf16b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Roteiro manual: rótulos da barra inferior no mobile

Use este checklist sempre que alterar a navegação inferior:

1. Abrir o preview e alternar para larguras móveis pequenas: **320px**, **360px**, **375px** e **390px**.
2. Conferir a barra inferior na rota inicial `/`.
3. Validar que os rótulos visíveis (`Árvore`, `Painel`, `Foco`, `Ops`, `Mais`) aparecem em **uma única linha**.
4. Validar que nenhum rótulo aumenta a altura da barra, empurra ícones ou quebra para duas linhas.
5. Abrir o menu **Mais** e navegar para um módulo secundário, como `Calendário` ou `Digital`.
6. Conferir que o botão **Mais** continua com rótulo em uma linha quando mostra o módulo ativo.
7. Repetir nas larguras **320px** e **360px**, que são os casos mais críticos.

Critério de aprovação: todos os rótulos devem permanecer centralizados, truncados quando necessário e sem quebra de linha em qualquer largura móvel testada.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/1720a410-34cd-4410-995c-8c92c7edf16b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
