require 'redis'

uri = if Rails.env.development? || Rails.env.test?
        URI.parse('localhost:6379')
      else
        URI.parse(ENV['REDISTOGO_URL'])
      end

REDIS = Redis.new(host: uri.host, port: uri.port, password: uri.password)
