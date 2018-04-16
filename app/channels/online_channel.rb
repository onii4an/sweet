class OnlineChannel < ApplicationCable::Channel
  def subscribed
    stream_from 'online'
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
