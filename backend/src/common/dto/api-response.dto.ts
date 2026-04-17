export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationDto;

  static success<T>(data: T, pagination?: PaginationDto): ApiResponse<T> {
    return {
      success: true,
      data,
      pagination,
    };
  }
}

export class MessageResponse {
  message: string;

  static from(message: string): MessageResponse {
    return { message };
  }
}

export class IdResponse {
  id: string | number;

  static from(id: string | number): IdResponse {
    return { id };
  }
}
