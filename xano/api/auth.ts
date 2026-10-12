import { apiGroup, query, input, s, c, inp, ref, auth, expr, guard } from "@xano/sdk";
import { user } from "../tables/user.js";

export const authApi = apiGroup({ name: "auth", canonical: "auth" });

const TOKEN_TTL = 30 * 86400;

export const signup = query({
  name: "signup",
  verb: "POST",
  apiGroup: authApi,
  input: {
    name: input.text({ required: true, methods: ["trim", "min:1"] }),
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true, methods: ["min:8"] }),
  },
  stack: [
    s.db.has({ table: user, fieldName: "email", fieldValue: inp("email"), as: "taken" }),
    guard.require(expr(ref("taken"), "=", c.bool(false)), {
      errorType: "badrequest",
      message: "that email already has an account, try logging in",
    }),
    s.db.add({
      table: user,
      row: { name: inp("name"), email: inp("email"), password: inp("password") },
      as: "created",
    }),
    s.security.create_auth_token({ table: user, id: ref("created.id"), expiration: c.int(TOKEN_TTL), as: "token" }),
  ],
  response: { token: ref("token") },
});

export const login = query({
  name: "login",
  verb: "POST",
  apiGroup: authApi,
  input: {
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({ table: user, fieldName: "email", fieldValue: inp("email"), output: ["id", "password"], as: "u" }),
    guard.found("u", { errorType: "unauthorized", message: "wrong email or password" }),
    s.security.check_password({ text_password: inp("password"), hash_password: ref("u.password"), as: "ok" }),
    guard.require(expr(ref("ok"), "=", c.bool(true)), {
      errorType: "unauthorized",
      message: "wrong email or password",
    }),
    s.security.create_auth_token({ table: user, id: ref("u.id"), expiration: c.int(TOKEN_TTL), as: "token" }),
  ],
  response: { token: ref("token") },
});

export const me = query({
  name: "me",
  verb: "GET",
  apiGroup: authApi,
  auth: user,
  stack: [
    s.db.get({ table: user, fieldValue: auth("id"), as: "me" }),
    guard.found("me", { errorType: "unauthorized", message: "sign in again" }),
  ],
  response: ref("me"),
});
