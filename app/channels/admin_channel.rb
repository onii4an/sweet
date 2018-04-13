class AdminChannel < ApplicationCable::Channel
  def subscribed
    stream_from 'admin' if current_user.type == 'Admin'
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
