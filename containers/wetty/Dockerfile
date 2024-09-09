FROM node:current-bookworm AS base

RUN apt install -y python3 git
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN npx pnpm i -g pnpm@latest
RUN pnpm env use -g 22


WORKDIR /usr/src/app
COPY . /usr/src/app
RUN rm -rf /usr/src/app/node_modules

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
RUN pnpm rebuild gc-stats

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:current-bookworm-slim
LABEL maintainer="ludo@asimovo.com"
WORKDIR /usr/src/app
ENV NODE_ENV=production
EXPOSE 3000
COPY asimovo_webcert /usr/src/app/
RUN chmod 600 /usr/src/app/asimovo_webcert
COPY --from=prod-deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=build /usr/src/app/build /usr/src/app/build
COPY package.json /usr/src/app/

RUN npm install -g nodemon
RUN apt update -y
RUN apt install -y procps coreutils openssh-client sshpass && \
    mkdir ~/.ssh
RUN apt -y clean
RUN adduser test
RUN echo "test:test" | chpasswd
CMD [ "npm", "start", "--", "--port", "3000", "--force-ssh" ]
