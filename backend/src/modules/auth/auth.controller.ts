import type {RequestHandler} from 'express';

import{ sendSuccess }from '../../utils/api-response.ts';
import * as authService from './auth.service.ts';
import type{LoginInput} from "./auth.types.ts"

export const login: RequestHandler = async(req, res) : Promise<void> => {
    const result = await authService.login(
        (res.locals.loginCredentials ?? req.body) as LoginInput
    );

    sendSuccess(res, {
        message: "Login Successful",
        data: result,
    })
}

export const getCurrentUser: RequestHandler = async( _req,res): Promise<void> => {
    const userId = res.locals.userId as string;
    const user = await authService.getCurrentUser(
        userId
    );

    sendSuccess(res, {
        message: "user retrieved successfully",
        data: user
    })
};

export const logout: RequestHandler = (_req, res) : void => {
    sendSuccess(res, {
        message: "logout successful",
        data: null,
    });
}
