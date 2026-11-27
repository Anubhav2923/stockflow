import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { prisma } from '../../db/prisma.ts';
import { ApiError } from '../../errors/app-error.ts';

import { authEnv } from './auth.validation.ts'

import type {
    LoginInput, LoginResponse, AuthUser
} from './auth.types.ts'

export const login = async(input: LoginInput):Promise<LoginResponse> => {
    const user = await prisma.user.findUnique({
        where: {
            username: input.username,
        },
    });

    if(!user) {
        throw new ApiError(
            "Invalid username or password",
            401,
            "INVALID_CREDENTIALS"
        )
    };

    const isPasswordValid = await bcrypt.compare(
        input.password, user.passwordHash
    );

    if(!isPasswordValid){
        throw new ApiError(
            "Invalid username or password",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    const accessToken = jwt.sign(
        { username: user.username },
        authEnv.JWT_SECRET,
        {
            subject: user.id.toString(),
            issuer: "stockflow",
            audience: "stockflow-api",
            algorithm: "HS256",
            expiresIn: authEnv.JWT_EXPIRES_IN,
        }
    );

    return {
        user : {
            id: user.id.toString(),
            username: user.username
        },
        accessToken,
        tokenType: "Bearer",
        expiresIn: authEnv.JWT_EXPIRES_IN,
    }
};

export const getCurrentUser = async(
    userId: string
) : Promise<AuthUser> => {
    const user = await prisma.user.findUnique({
        where: {
            id: Number(userId),
        },
        select : {
            id: true,
            username: true
        }
    });

    if(!user) {
        throw new ApiError (
            "User not found",
            401,
            "UNAUTHORIZED"
        )
    }

    return {
        id: user.id.toString(),
        username: user.username
    };
}